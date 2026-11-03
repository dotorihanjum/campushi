import copy
import json
import tempfile
import unittest
from unittest import mock

from fastapi.testclient import TestClient

from backend import main


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
        self.assertEqual(len(cse["years"]["3"]), 37)
        self.assertIn("데이터베이스", cse["years"]["3"])
        self.assertEqual(cse["games"]["객체지향프로그래밍"], "match")
        self.assertEqual(len(design["years"]["2"]), 10)

    def test_lesson_game(self):
        response = self.client.post("/api/lesson_game", json={"subject": "객체지향프로그래밍"})
        self.assertEqual(response.status_code, 200)
        game = response.json()["game"]
        self.assertEqual(game["course_name"], "객체지향프로그래밍")
        self.assertNotIn("check", game)
        # 문제가 없는 과목, 이 서비스의 과목이 아닌 과목은 404다.
        for subject in ["드로잉없음", "회계원리"]:
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
        item["years"]["2"] = ["자료구조"]
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
            with mock.patch.object(main, "GAMES_PATH", path):
                self.assertEqual(main.lesson_games(), {})
        main.lesson_games.cache_clear()


if __name__ == "__main__":
    unittest.main()
