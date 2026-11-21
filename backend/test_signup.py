import unittest
from unittest.mock import patch

from backend import accounts, login, signup
from backend.test_login import LoginTest, IDENTITY, HEADERS


class SignupTest(unittest.TestCase):
    begin = LoginTest.begin
    callback = LoginTest.callback
    # 가입은 동일한 HTTP 경계와 테스트 저장소를 사용한다. 로그인 케이스는 별도 클래스에서 실행한다.
    def setUp(self):
        LoginTest.setUp(self)
        self.year = patch.object(signup, "current_year", return_value=2026); self.year.start(); self.addCleanup(self.year.stop)

    def form(self, **changes):
        return {"birth_year": 2011, "role": "student", "terms_agreed": True, "privacy_agreed": True, "policy_version": signup.registration_policy()["version"], **changes}

    def pending(self):
        self.callback()
        return self.client.cookies.get(login.PENDING)

    def test_boundary_year_rejected_without_user_or_birth_record_and_proof_consumed(self):
        self.pending()
        response = self.client.post("/api/auth/register", json=self.form(birth_year=2012), headers=HEADERS)
        self.assertEqual(response.status_code, 403)
        self.assertIn("만 14세", response.json()["detail"])
        self.assertEqual(response.json()["code"], "signup_age_restricted")
        self.assertEqual(self.store.users, {}); self.assertEqual(self.store.sessions, {})
        self.assertFalse(self.store.challenges)
        self.assertIsNone(self.client.cookies.get(login.PENDING))
        self.assertFalse(any("birth_year" in str(body) for _, _, body in self.store.requests if body))

    def test_age_cannot_be_changed_to_reuse_rejected_proof(self):
        ticket = self.pending()
        self.client.post("/api/auth/register", json=self.form(birth_year=2012), headers=HEADERS)
        self.client.cookies.set(login.PENDING, ticket)
        response = self.client.post("/api/auth/register", json=self.form(), headers=HEADERS)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.store.users, {})

    def test_required_consent_and_version_are_checked_before_creating_user(self):
        self.pending()
        for body in (self.form(birth_year=2012, terms_agreed=False), self.form(terms_agreed=False), self.form(privacy_agreed=False), self.form(policy_version="old"), self.form(role="admin"), self.form(birth_year="2011"), self.form(terms_agreed="true"), self.form(marketing_agreed=True)):
            with self.subTest(body=body):
                self.assertIn(self.client.post("/api/auth/register", json=body, headers=HEADERS).status_code, (400,409))
                self.assertEqual(self.store.users, {})

    def test_allowed_year_creates_one_user_and_existing_session_cookie(self):
        self.pending()
        response = self.client.post("/api/auth/register", json=self.form(), headers=HEADERS)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(self.store.users), 1); self.assertEqual(len(self.store.sessions), 1)
        self.assertEqual(response.json()["return_to"], "my")
        self.assertNotIn("id", response.json()["user"])
        self.assertTrue(any(c.startswith(accounts.SESSION_COOKIE + "=") for c in response.headers.get_list("set-cookie")))
        self.assertIsNone(self.client.cookies.get(login.PENDING))
        again = self.client.post("/api/auth/register", json=self.form(), headers=HEADERS)
        self.assertEqual(again.status_code, 401); self.assertEqual(len(self.store.users), 1)

    def test_signup_without_verified_identity_is_rejected(self):
        response = self.client.post("/api/auth/register", json=self.form(), headers=HEADERS)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.store.users, {})

    def test_email_identity_signup_never_uses_supabase_auth_users(self):
        identity = {"provider": "email", "subject": "student@example.com", "email": "student@example.com"}
        flow = {"return_to": "my"}
        response = login.finish_identity(identity, flow, type("Request", (), {"cookies": {}})(), self.store)
        ticket = next(c.split(";",1)[0].split("=",1)[1] for c in response.headers.getlist("set-cookie") if c.startswith(login.PENDING + "="))
        self.client.cookies.set(login.PENDING, ticket)
        self.assertEqual(self.client.post("/api/auth/register", json=self.form(role="mentor"), headers=HEADERS).status_code, 200)
        self.assertFalse(any("auth/v1" in table for _, table, _ in self.store.requests))
        body = next(body for _, table, body in self.store.requests if table == "rpc/register_login_account")
        self.assertNotIn("p_marketing", body); self.assertEqual(body["p_role"], "mentor")

    def test_preflight_checks_age_and_required_consent_without_database_write(self):
        denied = self.client.post("/api/auth/eligibility", json=self.form(birth_year=2012), headers=HEADERS)
        self.assertEqual(denied.status_code, 403); self.assertEqual(self.store.requests, [])
        accepted = self.client.post("/api/auth/eligibility", json=self.form(), headers=HEADERS)
        self.assertEqual(accepted.status_code, 200); self.assertEqual(self.store.requests, [])
        self.assertTrue(self.client.cookies.get(signup.REGISTRATION))

    def test_policy_urls_are_replaceable_and_unsafe_schemes_rejected(self):
        defaults = self.client.get("/api/auth/options").json()["policy"]
        self.assertTrue(defaults["placeholder"])
        with patch.dict("os.environ", {"VERCEL_ENV": "preview", "AUTH_TERMS_URL": ""}):
            self.assertTrue(self.client.get("/api/auth/options").json()["policy"]["placeholder"])
        with patch.dict("os.environ", {"AUTH_TERMS_URL": "https://campushi.example/terms", "AUTH_PRIVACY_URL": "https://campushi.example/privacy", "AUTH_TERMS_VERSION": "2026-11"}):
            policy = signup.registration_policy()
            self.assertFalse(policy["placeholder"]); self.assertEqual(policy["version"], "2026-11")
        with patch.dict("os.environ", {"AUTH_TERMS_URL": "javascript:alert(1)"}):
            self.assertEqual(self.client.get("/api/auth/options").status_code, 503)

    def test_cancel_discards_pending_identity_without_creating_user(self):
        self.pending()
        response = self.client.post("/api/auth/cancel", json={}, headers=HEADERS)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(self.client.cookies.get(login.PENDING))
        self.assertEqual(self.store.challenges, {})
        self.assertEqual(self.store.users, {})
        self.assertEqual(self.store.sessions, {})


    def test_production_signup_requires_both_real_urls_and_version(self):
        configured = {
            "AUTH_TERMS_URL": "https://campushi.kr/terms",
            "AUTH_PRIVACY_URL": "https://campushi.kr/privacy",
            "AUTH_TERMS_VERSION": "2026-11",
        }
        body = self.form(policy_version="2026-11")
        self.pending()
        for override in (
            {"AUTH_TERMS_URL": "https://example.com/other"},
            {"AUTH_TERMS_URL": ""},
            {"AUTH_PRIVACY_URL": "javascript:alert(1)"},
            {"AUTH_PRIVACY_URL": ""},
            {"AUTH_TERMS_VERSION": "development-placeholder-v1"},
            {"AUTH_TERMS_VERSION": "   "},
        ):
            with self.subTest(override=override), patch.dict(
                "os.environ", {**configured, **override, "VERCEL_ENV": "production"}
            ):
                options = self.client.get("/api/auth/options").json()
                self.assertIsNone(options["policy"])
                self.assertIn("google", options["providers"])
                self.assertTrue(options["signup_notice"])
                for endpoint in ("eligibility", "register"):
                    response = self.client.post("/api/auth/" + endpoint, json=body, headers=HEADERS)
                    self.assertEqual(response.status_code, 503)
                self.assertEqual(self.store.users, {})
                self.assertEqual(self.store.sessions, {})
        with patch.dict("os.environ", {**configured, "VERCEL_ENV": "production"}):
            self.assertEqual(self.client.get("/api/auth/options").json()["policy"]["version"], "2026-11")
            self.assertEqual(self.client.post("/api/auth/register", json=body, headers=HEADERS).status_code, 200)

    def test_production_without_policy_still_signs_in_existing_account(self):
        self.pending()
        self.assertEqual(self.client.post("/api/auth/register", json=self.form(), headers=HEADERS).status_code, 200)
        with patch.dict("os.environ", {"VERCEL_ENV": "production"}):
            self.assertIsNone(self.client.get("/api/auth/options").json()["policy"])
            response = self.callback()
            self.assertIn("auth=success", response.headers["location"])
            self.assertIn(accounts.SESSION_COOKIE, response.headers["set-cookie"])
