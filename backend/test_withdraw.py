"""#36 회원 탈퇴: 세션 소유자 계정만 지우고, 같은 신원으로 다시 오면 새 가입으로 처리한다."""
import copy
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient

from backend import accounts, login, main, signup
from backend.record_rules import empty_state
from backend.test_login import ENV, HEADERS

IDENTITY = {"provider": "google", "subject": "google-withdraw", "email": "leaver@example.com"}
SIGNUP = {"birth_year": 2008, "role": "student", "terms_agreed": True, "privacy_agreed": True, "marketing_agreed": False}


class WithdrawStore:
    """users(id)에 on delete cascade로 걸린 테이블을 흉내 낸다. delete_account는 세션 소유자일 때만 지운다."""

    def __init__(self):
        self.users, self.identities, self.sessions = {}, {}, {}
        self.records, self.operations, self.ledger = {}, set(), []
        self.challenges = {}
        self.calls = []
        self.fail_delete = False

    def add_user(self, email, provider="google", subject=None):
        user = {"id": str(uuid4()), "provider": provider, "email": email, "role": "student", "birth_year": 2008,
                "terms_agreed_at": "2026-11-20T01:00:00Z", "created_at": "2026-11-20T01:00:00Z"}
        self.users[user["id"]] = user
        self.identities[(provider, subject or email)] = user["id"]
        return user

    def add_session(self, user_id, expires=None):
        token = accounts.secrets.token_urlsafe(accounts.TOKEN_BYTES)
        self.sessions[accounts.hash_token(token)] = {"user_id": user_id, "expires_at": expires or datetime.now(timezone.utc) + timedelta(days=1)}
        return token

    def owned(self, user_id):
        return {
            "user": user_id in self.users,
            "identities": [k for k, v in self.identities.items() if v == user_id],
            "sessions": [k for k, v in self.sessions.items() if v["user_id"] == user_id],
            "records": user_id in self.records,
            "operations": [k for k in self.operations if k[0] == user_id],
            "ledger": [row for row in self.ledger if row["user_id"] == user_id],
        }

    def call(self, method, table, params=None, body=None, prefer=None):
        self.calls.append((method, table, copy.deepcopy(body)))
        params = params or {}
        if table == "sessions" and method == "GET":
            row = self.sessions.get(params["token_hash"][3:])
            now = datetime.fromisoformat(params["expires_at"][3:])
            if not row or row["expires_at"] <= now:
                return httpx.Response(200, json=[])
            return httpx.Response(200, json=[{"user": self.users[row["user_id"]]}])
        if table == "sessions" and method == "POST":
            self.sessions[body["token_hash"]] = {"user_id": body["user_id"], "expires_at": datetime.fromisoformat(body["expires_at"])}
            return httpx.Response(201)
        if table == "sessions" and method == "DELETE":
            self.sessions.pop(params["token_hash"][3:], None)
            return httpx.Response(204)
        if table == "account_records":
            doc = self.records.get(params["user_id"][3:])
            return httpx.Response(200, json=[doc] if doc else [])
        if table == "rpc/account_credit_balance":
            return httpx.Response(200, json=sum(r["amount"] for r in self.ledger if r["user_id"] == body["p_user_id"]))
        if table == "rpc/delete_account":
            if self.fail_delete:
                raise accounts.AccountError(503, accounts.UNREACHABLE)
            row = self.sessions.get(body["p_token_hash"])
            if not row or row["user_id"] != body["p_user_id"] or row["expires_at"] <= datetime.now(timezone.utc):
                return httpx.Response(200, json=False)
            uid = body["p_user_id"]
            self.users.pop(uid)
            self.identities = {k: v for k, v in self.identities.items() if v != uid}
            self.sessions = {k: v for k, v in self.sessions.items() if v["user_id"] != uid}
            self.records.pop(uid, None)
            self.operations = {k for k in self.operations if k[0] != uid}
            self.ledger = [r for r in self.ledger if r["user_id"] != uid]
            return httpx.Response(200, json=True)
        if table == "user_identities":
            uid = self.identities.get((params["provider"][3:], params["provider_user_id"][3:]))
            return httpx.Response(200, json=[{"user": self.users[uid]}] if uid else [])
        if table == "rpc/find_login_account":
            return httpx.Response(200, json=[{"id": u["id"], "provider": u["provider"]} for u in self.users.values() if (u["email"] or "").lower() == body["p_email"].lower()])
        if table == "auth_challenges":
            self.challenges[body["token_hash"]] = body["purpose"]
            return httpx.Response(201)
        if table == "rpc/consume_auth_challenge":
            valid = self.challenges.get(body["p_hash"]) == body["p_purpose"]
            if valid:
                self.challenges.pop(body["p_hash"])
            return httpx.Response(200, json=valid)
        if table == "rpc/register_login_account":
            assert self.challenges.pop(body["p_proof_hash"]) == "signup"
            user = self.add_user(body["p_email"], body["p_provider"], body["p_subject"])
            return httpx.Response(200, json=user)
        raise AssertionError((method, table))


class WithdrawTest(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, ENV, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.store = WithdrawStore()
        main.app.dependency_overrides[accounts.account_store] = lambda: self.store
        self.addCleanup(main.app.dependency_overrides.clear)
        self.client = TestClient(main.app, base_url="https://testserver")
        self.me = self.seed(IDENTITY["email"], IDENTITY["subject"])
        self.other = self.seed("other@example.com", "google-other")
        self.other_token = self.store.add_session(self.other["id"])
        self.token = self.store.add_session(self.me["id"])
        self.login(self.token)

    def seed(self, email, subject):
        user = self.store.add_user(email, subject=subject)
        uid = user["id"]
        state = {**empty_state(), "nickname": email.split("@")[0], "profilePhoto": "data:image/jpeg;base64,AAAA",
                 "journeys": {"khu-cse": {}, "khu-id": {}},
                 "records": {"khu-cse|이산구조": {"grade": "A+"}, "khu-cse|미분방정식": {"grade": "F"}, "khu-id|기초디자인": {"grade": "P"}},
                 "notes": {"khu-cse|이산구조": "재밌었다", "khu-id|기초디자인": ""}, "credits": 10}
        self.store.records[uid] = {"revision": 3, "state": state}
        self.store.operations.add((uid, str(uuid4())))
        for key in ("khu-cse|이산구조", "khu-id|기초디자인"):
            self.store.ledger.append({"user_id": uid, "course_key": key, "amount": 5})
        return user

    def login(self, token):
        self.client.cookies.clear()
        self.client.cookies.set(accounts.SESSION_COOKIE, token)

    def withdraw(self, body=None, headers=HEADERS):
        return self.client.post("/api/me/withdraw", json={"confirm": True} if body is None else body, headers=headers)

    def test_summary_shows_ledger_credits_and_what_is_deleted(self):
        r = self.client.get("/api/me/withdraw")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json(), {"credits": 10, "departments": 2, "courses": 3, "passed": 2, "notes": 1, "profile": True})
        # 계정 문서가 아직 없는 새 계정도 0으로 보여 준다.
        fresh = self.store.add_user("fresh@example.com")
        self.login(self.store.add_session(fresh["id"]))
        self.assertEqual(self.client.get("/api/me/withdraw").json(), {"credits": 0, "departments": 0, "courses": 0, "passed": 0, "notes": 0, "profile": False})

    def test_withdraw_deletes_everything_of_the_session_owner_only(self):
        other_before = self.store.owned(self.other["id"])
        r = self.withdraw()
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json(), {"withdrawn": True})
        self.assertEqual(self.store.owned(self.me["id"]), {"user": False, "identities": [], "sessions": [], "records": False, "operations": [], "ledger": []})
        self.assertEqual(self.store.owned(self.other["id"]), other_before)
        cookies = r.headers.get_list("set-cookie")
        self.assertTrue(any(c.startswith(accounts.SESSION_COOKIE + '=""') and "Max-Age=0" in c for c in cookies), cookies)
        for name in (login.FLOW, login.PENDING, signup.REGISTRATION):
            self.assertTrue(any(c.startswith(name + "=") for c in cookies), name)
        # 지운 뒤에는 /api/me도 로그인하지 않은 상태다.
        self.assertEqual(self.client.get("/api/me").status_code, 401)

    def test_injected_user_id_is_rejected_and_never_used(self):
        for body in ({"confirm": True, "user_id": self.other["id"]}, {"confirm": True, "p_user_id": self.other["id"]}):
            self.assertEqual(self.withdraw(body).status_code, 400)
        self.assertTrue(self.store.owned(self.other["id"])["user"])
        self.assertTrue(self.store.owned(self.me["id"])["user"])
        deletes = [b for m, t, b in self.store.calls if t == "rpc/delete_account"]
        self.assertEqual(deletes, [])
        self.withdraw()
        deletes = [b for m, t, b in self.store.calls if t == "rpc/delete_account"]
        self.assertEqual([d["p_user_id"] for d in deletes], [self.me["id"]])
        self.assertTrue(self.store.owned(self.other["id"])["user"])

    def test_confirmation_origin_and_content_type_are_required(self):
        for body in ({}, {"confirm": False}, {"confirm": "true"}, {"confirm": 1}):
            r = self.withdraw(body)
            self.assertEqual(r.status_code, 400, body)
            self.assertIn("탈퇴", r.json()["detail"])
        self.assertEqual(self.withdraw(headers={}).status_code, 403)
        self.assertEqual(self.withdraw(headers={"origin": "https://evil.example"}).status_code, 403)
        r = self.client.post("/api/me/withdraw", content='{"confirm": true}', headers={**HEADERS, "content-type": "text/plain"})
        self.assertEqual(r.status_code, 415)
        self.assertTrue(self.store.owned(self.me["id"])["user"])

    def test_missing_or_expired_session_is_401_and_deletes_nothing(self):
        self.client.cookies.clear()
        r = self.withdraw()
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.json()["detail"], accounts.NOT_LOGGED_IN)
        self.assertEqual(self.client.get("/api/me/withdraw").status_code, 401)
        self.login(self.store.add_session(self.me["id"], datetime.now(timezone.utc) - timedelta(seconds=1)))
        r = self.withdraw()
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.json()["detail"], accounts.SESSION_ENDED)
        self.assertTrue(self.store.owned(self.me["id"])["user"])
        self.assertFalse(any(t == "rpc/delete_account" for _, t, _ in self.store.calls))

    def test_double_submit_second_request_is_safe_401(self):
        first = self.withdraw()
        self.assertEqual(first.status_code, 200)
        # 두 번째 요청이 같은 쿠키를 다시 보내도(연타) 이미 지워진 세션이라 401이고 아무것도 지우지 않는다.
        self.login(self.token)
        r = self.withdraw()
        self.assertEqual(r.status_code, 401)
        self.assertTrue(self.store.owned(self.other["id"])["user"])

    def test_session_deleted_between_lookup_and_delete_reports_ended(self):
        # 조회 뒤 다른 창에서 로그아웃해 세션이 사라지면 DB 함수가 False를 돌려준다. 탈퇴했다고 응답하지 않는다.
        original = self.store.call

        def racing(method, table, params=None, body=None, prefer=None):
            if table == "rpc/delete_account":
                self.store.sessions.clear()
            return original(method, table, params, body, prefer)

        self.store.call = racing
        r = self.withdraw()
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.json()["detail"], accounts.SESSION_ENDED)
        self.assertTrue(self.store.owned(self.me["id"])["user"])

    def test_store_failure_is_503_in_korean_and_keeps_the_account(self):
        self.store.fail_delete = True
        r = self.withdraw()
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json()["detail"], accounts.UNREACHABLE)
        self.assertTrue(self.store.owned(self.me["id"])["user"])
        self.assertFalse(any(c.startswith(accounts.SESSION_COOKIE + '=""') for c in r.headers.get_list("set-cookie")))

    def test_same_social_identity_after_withdrawal_goes_to_signup_not_old_account(self):
        old_id = self.me["id"]
        self.assertEqual(self.withdraw().status_code, 200)
        self.client.cookies.clear()
        start = self.client.post("/api/auth/start", json={"provider": "google"}, headers=HEADERS)
        state = parse_qs(urlsplit(start.json()["url"]).query)["state"][0]
        with patch.object(login, "exchange", return_value=IDENTITY):
            r = self.client.get("/api/auth/callback/google", params={"code": "c", "state": state}, follow_redirects=False)
        self.assertIn("auth=signup", r.headers["location"])
        self.assertFalse(any(c.startswith(accounts.SESSION_COOKIE + "=") for c in r.headers.get_list("set-cookie")))
        self.assertEqual(self.client.get("/api/auth/pending").json()["link_provider"], None)
        policy = self.client.get("/api/auth/options").json()["policy"]["version"]
        r = self.client.post("/api/auth/register", json={**SIGNUP, "policy_version": policy}, headers=HEADERS)
        self.assertEqual(r.status_code, 200, r.text)
        new = next(u for u in self.store.users.values() if u["email"] == IDENTITY["email"])
        self.assertNotEqual(new["id"], old_id)
        summary = self.client.get("/api/me/withdraw").json()
        self.assertEqual(summary, {"credits": 0, "departments": 0, "courses": 0, "passed": 0, "notes": 0, "profile": False})


if __name__ == "__main__":
    unittest.main()
