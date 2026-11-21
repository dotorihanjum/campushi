import copy
import json
import os
import time
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import httpx
from fastapi.testclient import TestClient

from backend import accounts, login, main

ENV = {"VITE_SUPABASE_URL": "https://test.supabase.co", "SUPABASE_SECRET_KEY": "sb_secret_" + "x" * 40,
       "AUTH_COOKIE_SECRET": "test-secret-" * 4, "AUTH_BASE_URL": "https://testserver", "GOOGLE_CLIENT_ID": "google-client", "GOOGLE_CLIENT_SECRET": "google-secret"}
USER = {"id": "00000000-0000-0000-0000-000000000001", "provider": "google", "email": "student@example.com", "role": "student", "birth_year": 2009, "terms_agreed_at": "2026-11-20T01:00:00Z", "created_at": "2026-11-20T01:00:00Z"}
IDENTITY = {"provider": "google", "subject": "google-123", "email": "student@example.com"}
HEADERS = {"origin": "https://testserver"}


class LoginStore:
    def __init__(self):
        self.users = {}
        self.identities = {}
        self.challenges = {}
        self.sessions = {}
        self.requests = []
        self.rate_allowed = True

    def call(self, method, table, params=None, body=None, prefer=None):
        self.requests.append((method, table, copy.deepcopy(body)))
        params = params or {}
        if table == "user_identities":
            key = (params["provider"][3:], params["provider_user_id"][3:])
            user = self.identities.get(key)
            return httpx.Response(200, json=[{"user": user}] if user else [])
        if table == "users":
            email = params.get("email", "")[3:]
            return httpx.Response(200, json=[u for u in self.users.values() if u["email"] == email])
        if table == "auth_challenges":
            self.challenges[body["token_hash"]] = body["purpose"]
            return httpx.Response(201)
        if table == "rpc/begin_email_login":
            if self.rate_allowed: self.challenges[body["p_hash"]] = "email"
            return httpx.Response(200, json=self.rate_allowed)
        if table == "rpc/consume_auth_challenge":
            valid = self.challenges.get(body["p_hash"]) == body["p_purpose"]
            if valid: self.challenges.pop(body["p_hash"])
            return httpx.Response(200, json=valid)
        if table == "rpc/link_login_identity":
            assert self.challenges.pop(body["p_proof_hash"]) == "signup"
            self.identities[(body["p_provider"], body["p_subject"])] = self.users[body["p_user_id"]]
            return httpx.Response(200, json=True)
        if table == "sessions":
            if method == "POST": self.sessions[body["token_hash"]] = body
            elif method == "DELETE": self.sessions.pop(params["token_hash"][3:], None)
            return httpx.Response(201 if method == "POST" else 204)
        raise AssertionError((method, table))


class LoginTest(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, ENV, clear=True); self.env.start(); self.addCleanup(self.env.stop)
        self.store = LoginStore()
        main.app.dependency_overrides[accounts.account_store] = lambda: self.store
        self.addCleanup(main.app.dependency_overrides.clear)
        self.client = TestClient(main.app, base_url="https://testserver")

    def begin(self, provider="google", link=False):
        r = self.client.post("/api/auth/start", json={"provider": provider, "link": link}, headers=HEADERS)
        self.assertEqual(r.status_code, 200)
        return parse_qs(urlsplit(r.json()["url"]).query)

    def callback(self, identity=IDENTITY, query=None):
        query = query or self.begin()
        with patch.object(login, "exchange", return_value=identity):
            return self.client.get("/api/auth/callback/" + identity["provider"], params={"code": "code", "state": query["state"][0]}, follow_redirects=False)

    def test_origin_and_return_target_are_checked(self):
        self.assertEqual(self.client.post("/api/auth/start", json={"provider": "google"}).status_code, 403)
        self.assertEqual(self.client.post("/api/auth/start", json={"provider": "google", "return_to": "https://evil.example"}, headers=HEADERS).status_code, 400)
        self.assertEqual(self.client.post("/api/auth/start", json={"provider": "admin"}, headers=HEADERS).status_code, 503)

    def test_pkce_state_and_secure_cookie(self):
        query = self.begin()
        self.assertEqual(query["code_challenge_method"], ["S256"])
        self.assertEqual(query["redirect_uri"], ["https://testserver/api/auth/callback/google"])
        flow = login.unseal(self.client.cookies.get(login.FLOW), "flow")
        self.assertEqual(len(flow["verifier"]), 64)
        self.assertNotIn("google-secret", query)
        with patch.object(login, "exchange") as exchange:
            r = self.client.get("/api/auth/callback/google?state=wrong&code=x", follow_redirects=False)
            self.assertIn("auth=error", r.headers["location"]); exchange.assert_not_called()

    def test_existing_account_uses_existing_sessions_without_new_user(self):
        self.store.identities[("google", "google-123")] = USER
        r = self.callback()
        self.assertIn("auth=success", r.headers["location"])
        cookie = next(v for v in r.headers.get_list("set-cookie") if v.startswith(accounts.SESSION_COOKIE + "="))
        for flag in ("HttpOnly", "Secure", "SameSite=lax", "Path=/"): self.assertIn(flag, cookie)
        self.assertEqual(len(self.store.sessions), 1)
        self.assertFalse(any(m == "POST" and t == "users" for m, t, _ in self.store.requests))

    def test_new_identity_is_temporary_and_does_not_create_any_account(self):
        r = self.callback()
        self.assertIn("auth=signup", r.headers["location"])
        self.assertEqual(self.store.users, {}); self.assertEqual(self.store.sessions, {})
        self.assertTrue(self.client.cookies.get(login.PENDING))
        for _, table, body in self.store.requests:
            self.assertNotIn("auth/v1", table)
            if table == "auth_challenges":
                self.assertNotIn("email", body); self.assertNotIn("subject", body)
        self.assertEqual(self.client.get("/api/auth/pending").json(), {"pending": True, "link_provider": None})

    def test_cancellation_has_retry_route_and_no_user(self):
        q = self.begin()
        r = self.client.get("/api/auth/callback/google", params={"state": q["state"][0], "error": "access_denied"}, follow_redirects=False)
        self.assertIn("auth=cancelled", r.headers["location"]); self.assertEqual(self.store.users, {})

    def test_ticket_forgery_expiration_and_provider_mismatch_fail(self):
        signed = login.seal("flow", {"provider": "google"})
        for value in (None, signed + "x", "bad", login.seal("signup", {})):
            with self.assertRaises(Exception): login.unseal(value, "flow")
        with patch.object(login.time, "time", return_value=time.time() + 601):
            with self.assertRaises(Exception): login.unseal(signed, "flow")
        self.begin()
        with patch.object(login, "exchange") as exchange:
            r = self.client.get("/api/auth/callback/kakao?code=x&state=x", follow_redirects=False)
            self.assertIn("auth=error", r.headers["location"]); exchange.assert_not_called()

    def test_email_link_is_browser_bound_and_single_use(self):
        with patch.dict(os.environ, {"SMTP_HOST": "smtp.test", "SMTP_FROM": "test@example.com", "SMTP_USERNAME": "user", "SMTP_PASSWORD": "secret"}), patch.object(login, "send_email") as send:
            r = self.client.post("/api/auth/email", json={"email": "student@example.com"}, headers=HEADERS)
            self.assertEqual(r.status_code, 200)
            url = send.call_args.args[1]
            stranger = TestClient(main.app, base_url="https://testserver")
            self.assertIn("auth=error", stranger.get(url, follow_redirects=False).headers["location"])
            self.assertIn("auth=signup", self.client.get(url, follow_redirects=False).headers["location"])
            self.assertIn("auth=error", self.client.get(url, follow_redirects=False).headers["location"])
            self.assertEqual(self.store.users, {})

    def test_same_email_requires_fresh_existing_provider_login_before_linking(self):
        self.store.users[USER["id"]] = USER
        new_identity = {"provider": "kakao", "subject": "12345", "email": USER["email"]}
        with patch.dict(os.environ, {"KAKAO_CLIENT_ID": "id", "KAKAO_CLIENT_SECRET": "secret"}):
            self.callback(new_identity, self.begin("kakao"))
        self.assertEqual(self.client.get("/api/auth/pending").json()["link_provider"], "google")
        self.assertEqual(self.store.identities, {})
        self.store.identities[("google", "google-123")] = USER
        response = self.callback(query=self.begin("google", True))
        self.assertIn("auth=success", response.headers["location"])
        self.assertEqual(self.store.identities[("kakao", "12345")]["id"], USER["id"])

    def test_wrong_existing_account_cannot_link(self):
        self.store.users[USER["id"]] = USER
        self.callback()
        wrong = {**USER, "id": "00000000-0000-0000-0000-000000000002"}
        self.store.identities[("google", "google-123")] = wrong
        response = self.callback(query=self.begin("google", True))
        self.assertIn("auth=error", response.headers["location"])
        self.assertFalse(any(t == "rpc/link_login_identity" for _, t, _ in self.store.requests))
