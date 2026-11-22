import copy
import hashlib
import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

import httpx
from fastapi.testclient import TestClient
from starlette.requests import Request
from starlette.responses import Response

from backend import accounts, main, theory_banks


class ApiTest(unittest.TestCase):
    def setUp(self):
        main.departments.cache_clear()
        main.lesson_games.cache_clear()
        self.client = TestClient(main.app)

    def test_health(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["departments"], 2)
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_departments_follow_official_curriculum(self):
        items = self.client.get("/api/departments").json()["departments"]
        self.assertEqual([item["id"] for item in items], ["khu-cse", "khu-id"])
        for item in items:
            self.assertNotIn("partner", item)
            self.assertTrue(item["source"]["url"].startswith("https://"))
            self.assertIn(item["final"], item["years"]["4"])
            # 연습 문제 유형은 편성표 과목의 것만 보낸다.
            subjects = {subject for year in main.YEARS for subject in item["years"][year]}
            self.assertTrue(set(item["games"]) <= subjects)
        cse, design = items
        # 필수과목(전공기초·전공필수)은 공식 편성표의 이수구분 그대로다.
        self.assertEqual(cse["kinds"]["전공기초"], ["미분방정식", "선형대수", "미분적분학", "확률및랜덤변수"])
        self.assertIn("객체지향프로그래밍", cse["kinds"]["전공필수"])
        self.assertNotIn("이산구조", cse["kinds"]["전공필수"] + cse["kinds"]["전공기초"])
        self.assertEqual(len(design["kinds"]["전공기초"]), 7)
        self.assertEqual((cse["building"], design["building"]), ("전자정보/응용과학대학관", "예술·디자인대학관"))
        self.assertEqual(len(cse["years"]["3"]), 35)
        self.assertIn("데이터베이스", cse["years"]["3"])
        # 2023-1 ~ 2026-2 개설 기록이 없는 과목은 뺐다(SOURCE.md).
        self.assertNotIn("웹보안", cse["years"]["4"])
        # 이론 퀴즈 15과목은 2026-11-10에 내렸다가 2026-11-12 사용자 결정으로 다시 공개했다. 지금 공개한 연습 문제는 이 15과목뿐이다.
        self.assertEqual(
            set(cse["games"]),
            {"이산구조", "미분적분학", "미분방정식", "선형대수", "실감미디어컴퓨팅기초",
             "신호와시스템", "회로와신호", "확률및랜덤변수", "컴퓨터구조", "논리회로", "기계학습",
             "게임프로그래밍입문", "풀스택서비스네트워킹", "마이크로서비스프로그래밍", "오픈소스SW개발방법및도구"},
        )
        self.assertEqual(set(cse["games"].values()), {"theory"})
        self.assertEqual(design["games"], {})
        self.assertEqual(len(design["years"]["2"]), 10)

    def test_lesson_game(self):
        bank = next(bank for bank in theory_banks.load() if bank["course_name"] == "이산구조")
        main.lesson_games.cache_clear()
        with tempfile.TemporaryDirectory() as folder:
            path = main.Path(folder) / "theory.jsonl"
            path.write_text(json.dumps({**bank, "status": "verified"}, ensure_ascii=False), encoding="utf-8")
            with mock.patch.object(main, "THEORY_PATH", path):
                response = self.client.post("/api/lesson_game", json={"subject": "이산구조"})
                self.assertEqual(response.status_code, 200)
                game = response.json()["game"]
                self.assertEqual(game["course_name"], "이산구조")
                self.assertNotIn("check", game)
        main.lesson_games.cache_clear()
        # 문제가 없는 과목(구현 예정), 이 서비스의 과목이 아닌 과목은 404다.
        for subject in ["객체지향프로그래밍", "드로잉", "회계원리"]:
            response = self.client.post("/api/lesson_game", json={"subject": subject})
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response.json()["detail"], "이 과목의 연습 문제가 아직 없어요.")

    def test_bad_requests(self):
        self.assertEqual(self.client.post("/api/lesson_game", json={"subject": ""}).json()["detail"], "과목을 작성해주세요.")
        self.assertEqual(self.client.post("/api/lesson_game", json={"subject": "가", "extra": 1}).status_code, 400)
        big = self.client.post("/api/lesson_game", content="x" * (main.MAX_BODY_BYTES + 1), headers={"content-type": "application/json"})
        self.assertEqual(big.status_code, 413)
        self.assertEqual(self.client.get("/api/없는주소").status_code, 404)

    def test_broken_department_data_is_rejected(self):
        original = json.loads(main.DEPARTMENTS_PATH.read_text(encoding="utf-8"))["departments"][0]
        broken = []
        item = copy.deepcopy(original)
        item["years"]["2"] = []
        broken.append(item)
        item = copy.deepcopy(original)
        item["kinds"] = {"전공필수": ["없는과목"]}
        broken.append(item)
        item = copy.deepcopy(original)
        item["kinds"] = {"교양": []}
        broken.append(item)
        item = copy.deepcopy(original)
        item["years"]["1"] = ["객체지향프로그래밍", "객체지향프로그래밍", "이산구조"]
        broken.append(item)
        item = copy.deepcopy(original)
        item["final"] = "없는과목"
        broken.append(item)
        item = copy.deepcopy(original)
        item["practice"] = "없는과목"
        broken.append(item)
        item = copy.deepcopy(original)
        item["source"]["url"] = "http://example.com"
        broken.append(item)
        item = copy.deepcopy(original)
        item["building"] = ""
        broken.append(item)
        item = copy.deepcopy(original)
        del item["years"]["4"]
        broken.append(item)
        for item in broken:
            with self.assertRaises(ValueError):
                main.check_department(item)
        main.check_department(original)

    def test_unverified_games_are_hidden(self):
        main.lesson_games.cache_clear()
        lines = [
            json.dumps({"course_name": "객체지향프로그래밍", "type": "ox", "status": "review"}),
            json.dumps({"course_name": "회계원리", "type": "ox", "status": "verified"}),
        ]
        with tempfile.TemporaryDirectory() as folder:
            path = main.Path(folder) / "games.jsonl"
            path.write_text("\n".join(lines), encoding="utf-8")
            # 이론 문제 은행은 따로 읽으므로 없는 파일로 두고 고정 문제만 본다.
            with mock.patch.object(main, "GAMES_PATH", path), mock.patch.object(main, "THEORY_PATH", main.Path(folder) / "없음.jsonl"):
                self.assertEqual(main.lesson_games(), {})
        main.lesson_games.cache_clear()

    def test_theory_bank_replaces_fixed_game(self):
        # 이론 수업 문제 은행이 있는 과목은 고정된 문제 대신 은행(유형 theory)을 준다. 검증 기록은 내보내지 않는다.
        bank = theory_banks.load()[0]
        main.lesson_games.cache_clear()
        with tempfile.TemporaryDirectory() as folder:
            path = main.Path(folder) / "theory.jsonl"
            path.write_text(json.dumps({**bank, "status": "verified"}, ensure_ascii=False), encoding="utf-8")
            with mock.patch.object(main, "THEORY_PATH", path):
                games = self.client.get("/api/departments").json()["departments"][0]["games"]
                self.assertEqual(games[bank["course_name"]], "theory")
                game = self.client.post("/api/lesson_game", json={"subject": bank["course_name"]}).json()["game"]
                self.assertEqual(game["type"], "theory")
                self.assertNotIn("check", game)
                self.assertTrue(game["terms"] and game["facts"] and game["units"])
        main.lesson_games.cache_clear()

    def test_restored_theory_banks_are_served(self):
        # 2026-11-10에 내렸던 이론 퀴즈를 2026-11-12 사용자 결정으로 다시 공개했다. 내린 기록과 다시 공개한 기록은 check에 남고 화면에는 보내지 않는다.
        main.lesson_games.cache_clear()
        banks = theory_banks.load()
        self.assertTrue(all(bank["status"] == "verified" and bank["check"].get("withdrawn") and bank["check"].get("restored") for bank in banks))
        response = self.client.post("/api/lesson_game", json={"subject": "미분방정식"})
        self.assertEqual(response.status_code, 200)
        game = response.json()["game"]
        self.assertEqual(game["type"], "theory")
        self.assertNotIn("check", game)

    def test_unverified_theory_banks_are_hidden(self):
        bank = theory_banks.load()[0]
        main.lesson_games.cache_clear()
        with tempfile.TemporaryDirectory() as folder:
            path = main.Path(folder) / "theory.jsonl"
            path.write_text(json.dumps({**bank, "status": "draft"}, ensure_ascii=False), encoding="utf-8")
            with mock.patch.object(main, "THEORY_PATH", path):
                self.assertNotEqual(main.lesson_games().get(bank["course_name"], {}).get("type"), "theory")
        main.lesson_games.cache_clear()


class TheoryBankTest(unittest.TestCase):
    def test_meaning_must_not_contain_term(self):
        bank = copy.deepcopy(theory_banks.load()[0])
        bank["terms"][0]["meaning"] = bank["terms"][0]["term"] + "의 뜻"
        self.assertTrue(any("뜻에 용어" in issue for issue in theory_banks.problems(bank)))

    def test_service_banks_are_valid(self):
        banks = theory_banks.load()
        self.assertTrue(banks)
        for bank in banks:
            self.assertEqual(theory_banks.problems(bank), [], bank["course_name"])
            self.assertIn(bank["status"], ("verified", "rejected", "draft"))

    def test_blind_sheet_hides_answers(self):
        bank = theory_banks.load()[0]
        sheet = json.dumps(theory_banks.blind(bank, seed=1), ensure_ascii=False)
        self.assertNotIn('"answer"', sheet)
        self.assertNotIn('"unit"', sheet)
        for fact in bank["facts"]:
            self.assertNotIn(fact["explanation"], sheet)

    def test_apply_drops_wrong_or_flagged_items(self):
        bank = copy.deepcopy(theory_banks.load()[0])
        bank["status"] = "draft"
        answers = {}
        for i, item in enumerate(bank["terms"]):
            answers[f"term-{i}"] = item["term"]
            answers[f"unit-{i}"] = bank["units"][item["unit"]]
        for i, item in enumerate(bank["facts"]):
            answers[f"fact-{i}"] = item["answer"]
        for i, item in enumerate(bank["sequences"]):
            answers[f"seq-{i}"] = item["steps"]
        answers["term-0"] = "틀린 답"
        answers["fact-1"] = not bank["facts"][1]["answer"]
        result = theory_banks.apply(bank, {"reviewer": "검토", "answers": answers, "flags": {"seq-0": "순서가 둘"}})
        self.assertEqual(result["status"], "verified")
        self.assertEqual(sorted(result["check"]["removed"]), ["fact-1", "seq-0", "term-0"])
        self.assertNotIn(bank["terms"][0], result["terms"])
        self.assertEqual(len(result["facts"]), len(bank["facts"]) - 1)
        # 너무 많이 빠져 형식을 만족하지 못하면 공개하지 않는다.
        wrong = {key: "틀림" for key in answers}
        self.assertEqual(theory_banks.apply(bank, {"answers": wrong})["status"], "rejected")


# 계정·세션(이슈 #30). 운영 Supabase에는 붙지 않고, Supabase REST(PostgREST) 호출을 가짜 HTTP 응답으로 대신한다.
SUPABASE_ENV = {"VITE_SUPABASE_URL": "https://test-project.supabase.co", "SUPABASE_SECRET_KEY": "sb_secret_test_only"}
ACCOUNT = {
    "id": "6f1c1b7e-0000-4000-8000-000000000001",
    "provider": "kakao",
    "provider_user_id": "kakao-12345",
    "email": "student@example.com",
    "role": "student",
    "birth_year": 2009,
    "terms_agreed_at": "2026-11-18T01:00:00+00:00",
    "created_at": "2026-11-18T01:00:00+00:00",
}


class FakePostgrest:
    """테스트용 가짜 Supabase REST. sessions의 만들기·찾기(users 함께 읽기)·지우기만 흉내 내고, 받은 요청을 남긴다."""

    def __init__(self, users=(ACCOUNT,)):
        self.users = {user["id"]: user for user in users}
        self.sessions = {}
        self.requests = []

    def __call__(self, request):
        self.requests.append(request)
        if request.url.path != "/rest/v1/sessions":
            return httpx.Response(404, json={"message": "not found"})
        params = request.url.params
        if request.method == "POST":
            row = json.loads(request.content)
            self.sessions[row["token_hash"]] = row
            return httpx.Response(201)
        token_hash = params.get("token_hash", "").removeprefix("eq.")
        if request.method == "DELETE":
            self.sessions.pop(token_hash, None)
            return httpx.Response(204)
        row = self.sessions.get(token_hash)
        after = params.get("expires_at", "").removeprefix("gt.")
        if not row or not after or parse_time(row["expires_at"]) <= parse_time(after):
            return httpx.Response(200, json=[])
        user = self.users[row["user_id"]]
        fields = params["select"].split("(", 1)[1].rstrip(")").split(",")
        return httpx.Response(200, json=[{"user": {field: user[field] for field in fields}}])


def parse_time(text):
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def failing(status=None, error=None):
    def handler(request):
        if error:
            raise error
        return httpx.Response(status, json={"message": "fail"})

    return handler


class AccountTest(unittest.TestCase):
    def setUp(self):
        self.env = mock.patch.dict(os.environ, SUPABASE_ENV)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.db = FakePostgrest()
        self.use(self.db)
        self.client = TestClient(main.app)

    def use(self, handler):
        main.app.dependency_overrides[accounts.account_store] = lambda: accounts.store_from_env(transport=httpx.MockTransport(handler))
        self.addCleanup(main.app.dependency_overrides.clear)

    def login(self, now=None):
        response = Response()
        token = accounts.create_session(accounts.store_from_env(transport=httpx.MockTransport(self.db)), response, ACCOUNT["id"], now=now)
        return token, response

    def me(self, token=None):
        headers = {"Cookie": f"{accounts.SESSION_COOKIE}={token}"} if token is not None else {}
        return self.client.get("/api/me", headers=headers)

    def test_session_cookie_is_httponly_secure_samesite(self):
        token, response = self.login()
        cookie = response.headers["set-cookie"]
        self.assertTrue(cookie.startswith(f"{accounts.SESSION_COOKIE}={token};"))
        parts = [part.strip().lower() for part in cookie.split(";")]
        self.assertIn("httponly", parts)
        self.assertIn("secure", parts)
        self.assertIn("samesite=lax", parts)
        self.assertIn("path=/", parts)
        self.assertIn(f"max-age={accounts.DEFAULT_SESSION_DAYS * 86400}", parts)
        self.assertFalse(any(part.startswith("domain=") for part in parts))
        # 쿠키에는 무작위 토큰만, DB에는 그 해시만 남는다.
        self.assertRegex(token, r"^[A-Za-z0-9_-]{43}$")
        self.assertNotIn(token, json.dumps(self.db.sessions))
        self.assertEqual(list(self.db.sessions), [hashlib.sha256(token.encode()).hexdigest()])
        self.assertEqual(self.db.sessions[accounts.hash_token(token)]["user_id"], ACCOUNT["id"])
        # 서버 키는 apikey 헤더로만 보낸다.
        request = self.db.requests[0]
        self.assertEqual(request.headers["apikey"], SUPABASE_ENV["SUPABASE_SECRET_KEY"])
        self.assertEqual(str(request.url).split("?")[0], "https://test-project.supabase.co/rest/v1/sessions")
        # 토큰은 매번 다르다.
        self.assertNotEqual(self.login()[0], token)

    def test_session_length_comes_from_env(self):
        with mock.patch.dict(os.environ, {"SESSION_MAX_AGE_DAYS": "7"}):
            _, response = self.login(now=datetime(2026, 11, 18, tzinfo=timezone.utc))
        self.assertIn("Max-Age=604800", response.headers["set-cookie"])
        self.assertEqual(parse_time(next(iter(self.db.sessions.values()))["expires_at"]), datetime(2026, 11, 25, tzinfo=timezone.utc))
        # 숫자가 아니거나 범위(1~365일)를 벗어나면 기본값을 쓴다.
        for bad in ("abc", "0", "366", "-1", "1.5"):
            with mock.patch.dict(os.environ, {"SESSION_MAX_AGE_DAYS": bad}):
                self.assertEqual(accounts.session_days(), accounts.DEFAULT_SESSION_DAYS, bad)

    def test_me_returns_public_fields_only(self):
        token, _ = self.login()
        response = self.me(token)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(
            response.json(),
            {"user": {key: ACCOUNT[key] for key in ("provider", "email", "role", "birth_year", "terms_agreed_at", "created_at")}},
        )
        text = response.text
        for secret in (token, accounts.hash_token(token), ACCOUNT["id"], ACCOUNT["provider_user_id"], "expires_at"):
            self.assertNotIn(secret, text)
        # DB에서도 공개 필드만 읽는다.
        query = self.db.requests[-1].url.params
        self.assertNotIn("provider_user_id", query["select"])
        self.assertTrue(query["expires_at"].startswith("gt."))

    def test_me_without_login_is_401(self):
        response = self.me()
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"detail": "로그인이 필요해요."})
        self.assertEqual(self.db.requests, [])

    def test_me_with_expired_session_is_401(self):
        token, _ = self.login(now=datetime.now(timezone.utc) - timedelta(days=accounts.DEFAULT_SESSION_DAYS, seconds=1))
        response = self.me(token)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"detail": "로그인이 만료되었어요. 다시 로그인해 주세요."})
        # 쓸 수 없는 쿠키는 지운다(같은 속성으로 Max-Age=0).
        cookie = response.headers["set-cookie"]
        self.assertIn(f'{accounts.SESSION_COOKIE}=""', cookie)
        self.assertIn("Max-Age=0", cookie)
        self.assertIn("Secure", cookie)

    def test_me_with_forged_token_is_401(self):
        self.login()
        forged = ["x" * 43, "not a token", "../../etc", "a" * 500, ""]
        for token in forged:
            response = self.me(token)
            self.assertEqual(response.status_code, 401, token)
            self.assertEqual(response.json()["detail"], "로그인이 만료되었어요. 다시 로그인해 주세요." if token else "로그인이 필요해요.")
        # 형식이 맞는 위조 토큰만 DB에 물어보고(없으면 401), 형식이 틀린 것은 DB에 묻지도 않는다.
        lookups = [request for request in self.db.requests if request.method == "GET"]
        self.assertEqual(len(lookups), 1)

    def test_end_session_deletes_row_and_cookie(self):
        token, _ = self.login()
        request = Request({"type": "http", "headers": [(b"cookie", f"{accounts.SESSION_COOKIE}={token}".encode())]})
        response = Response()
        accounts.end_session(accounts.store_from_env(transport=httpx.MockTransport(self.db)), request, response)
        self.assertEqual(self.db.sessions, {})
        self.assertIn("Max-Age=0", response.headers["set-cookie"])
        self.assertEqual(self.me(token).status_code, 401)

    def test_me_without_supabase_env_explains_and_old_api_still_works(self):
        main.app.dependency_overrides.clear()
        for missing in (["VITE_SUPABASE_URL"], ["SUPABASE_SECRET_KEY"], ["VITE_SUPABASE_URL", "SUPABASE_SECRET_KEY"]):
            env = {key: value for key, value in os.environ.items() if key not in missing}
            with mock.patch.dict(os.environ, env, clear=True):
                response = self.me("x" * 43)
                self.assertEqual(response.status_code, 503, missing)
                self.assertEqual(response.json(), {"detail": "서버에 계정 저장소 설정이 없어 로그인 기능을 쓸 수 없어요."})
                self.assertEqual(self.client.get("/api/health").status_code, 200)
                self.assertEqual(self.client.get("/api/departments").status_code, 200)
                subject = next(iter(main.lesson_games()))
                self.assertEqual(self.client.post("/api/lesson_game", json={"subject": subject}).status_code, 200)
        # 주소가 https가 아니면(오타 등) 설정이 없는 것과 같이 본다. 로컬 Supabase(127.0.0.1)만 http를 허용한다.
        with mock.patch.dict(os.environ, {"VITE_SUPABASE_URL": "test-project.supabase.co"}):
            self.assertEqual(self.me("x" * 43).status_code, 503)
        with mock.patch.dict(os.environ, {"VITE_SUPABASE_URL": "http://127.0.0.1:54321"}):
            self.assertEqual(accounts.store_from_env().url, "http://127.0.0.1:54321")

    def test_supabase_failures_are_korean_without_internals(self):
        token, _ = self.login()
        cases = [
            # 무료 플랜 일시정지·점검·장애(5xx, 540), 연결 실패, 시간 초과
            (failing(540), 503, "계정 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요."),
            (failing(503), 503, "계정 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요."),
            (failing(error=httpx.ConnectError("boom")), 503, "계정 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요."),
            (failing(error=httpx.ReadTimeout("slow")), 503, "계정 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요."),
            # 서버 키가 틀렸거나 권한이 없음
            (failing(401), 500, "계정 서버 설정에 문제가 있어요. 잠시 후 다시 시도해 주세요."),
            (failing(403), 500, "계정 서버 설정에 문제가 있어요. 잠시 후 다시 시도해 주세요."),
            # 그 밖의 예상하지 못한 응답
            (failing(400), 502, "계정 서버의 응답을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."),
            (lambda request: httpx.Response(200, text="<html>"), 502, "계정 서버의 응답을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."),
            (lambda request: httpx.Response(200, json=[{"user": None}]), 502, "계정 서버의 응답을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."),
        ]
        for handler, status, detail in cases:
            self.use(handler)
            with self.assertLogs("uvicorn.error", level="ERROR"):
                response = self.me(token)
            self.assertEqual(response.status_code, status, detail)
            self.assertEqual(response.json(), {"detail": detail})
            for leak in ("Traceback", "supabase.co", "sb_secret", "boom", "fail"):
                self.assertNotIn(leak, response.text)

    def test_secret_key_is_not_in_frontend(self):
        # 서버 키 이름이 프론트 코드에 나오지 않는다(빌드 결과물은 PR에서 따로 확인).
        frontend = main.Path(__file__).parent.parent / "frontend" / "src"
        for path in frontend.rglob("*"):
            if path.suffix in (".js", ".jsx", ".ts", ".tsx", ".css", ".html"):
                self.assertNotIn("SUPABASE_SECRET_KEY", path.read_text(encoding="utf-8"), path)


from backend.test_login import LoginTest
from backend.test_signup import SignupTest
from backend.test_records import RecordTest
from backend.test_labs import LabRecordTest, LabRegistryTest


if __name__ == "__main__":
    unittest.main()
