import copy
import json
import tempfile
import unittest
from unittest import mock

from fastapi.testclient import TestClient

from backend import main, theory_banks


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
            self.assertTrue(item["partner"] and item["partner_example"])
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
        # 지금 공개한 연습 문제는 1학년 이론 수업 5과목의 문제 은행뿐이다(2026-11-09 사용자 결정, 나머지는 구현 예정).
        self.assertEqual(set(cse["games"]), {"이산구조", "미분적분학", "미분방정식", "선형대수", "실감미디어컴퓨팅기초"})
        self.assertEqual(design["games"], {})
        self.assertEqual(len(design["years"]["2"]), 10)

    def test_lesson_game(self):
        response = self.client.post("/api/lesson_game", json={"subject": "이산구조"})
        self.assertEqual(response.status_code, 200)
        game = response.json()["game"]
        self.assertEqual(game["course_name"], "이산구조")
        self.assertNotIn("check", game)
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
        games = self.client.get("/api/departments").json()["departments"][0]["games"]
        self.assertEqual(games["미분적분학"], "theory")
        self.assertEqual(games["이산구조"], "theory")
        game = self.client.post("/api/lesson_game", json={"subject": "선형대수"}).json()["game"]
        self.assertEqual(game["type"], "theory")
        self.assertNotIn("check", game)
        self.assertTrue(game["terms"] and game["facts"] and game["units"])

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


if __name__ == "__main__":
    unittest.main()
