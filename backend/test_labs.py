"""Real-class labs (frontend/src/labs) in the server record rules (#99).

The shared registry is backend/data/record_conditions.json "labs". Tests patch it with one lab, because no lab is published yet.
"""

import copy
import unittest
from unittest.mock import patch
from backend import main, record_rules
from backend.record_rules import check_conditions, empty_state, grandfather, imported
from backend.test_login import USER
from backend.test_records import RecordTest

CSE = "khu-cse"
LAB_COURSE = "객체지향프로그래밍"  # 1학년 전공필수, 이론 퀴즈 없음
QUIZ_COURSE = "이산구조"  # 1학년 전공선택, 이론 퀴즈 있음
YEAR1_QUIZZES = ["미분방정식", "미분적분학", "선형대수"]  # 1학년 필수 중 이론 퀴즈가 있는 과목
YEAR2_COURSE = "컴퓨터구조"


def registry(status="verified", subject=LAB_COURSE, since=4):
    """The real registry plus one lab, at condition version `since`."""
    real = record_rules.CONDITIONS
    return {
        "version": max(real["version"], since),
        "restored": real["restored"],
        "labs": {CSE: {subject: {"id": "oop-class", "status": status, "since": since}}},
    }


def earned(grade="A+"):
    return {"grade": grade, "percent": 100, "attempts": 1, "last": grade, "source": "earned"}


class LabRecordTest(unittest.TestCase):
    setUp = RecordTest.setUp
    operation = RecordTest.operation

    def complete(self, subject, score=None):
        return self.operation(
            [
                {
                    "kind": "complete",
                    "department": CSE,
                    "subject": subject,
                    "score": score or {"correct": 10, "total": 10},
                }
            ]
        )

    def publish(self, **lab):
        patcher = patch.object(record_rules, "CONDITIONS", registry(**lab))
        patcher.start()
        self.addCleanup(patcher.stop)

    def saved_state(self, state):
        self.store.docs[USER["id"]] = {"revision": 1, "state": state}

    def year2_opened_before_lab(self, conditions=3, quizzes=YEAR1_QUIZZES):
        state = empty_state()
        state.update(
            conditions=conditions,
            journeys={CSE: {"enrolledAt": 1}},
            records={CSE + "|" + s: earned() for s in quizzes},
            studying=CSE,
        )
        return state

    def test_verified_lab_course_is_accepted_for_signed_in_student(self):
        self.publish()
        self.operation([{"kind": "enroll", "department": CSE}])
        r = self.complete(LAB_COURSE, {"correct": 8, "total": 10})
        self.assertEqual(r.status_code, 200, r.text)
        state = r.json()["state"]
        self.assertEqual(state["records"][CSE + "|" + LAB_COURSE]["grade"], "B+")
        self.assertEqual(state["records"][CSE + "|" + LAB_COURSE]["source"], "earned")
        self.assertEqual(state["credits"], 5)
        # A lab without a score (P) is a lab result too.
        self.assertEqual(self.complete(LAB_COURSE, "P").status_code, 200)

    def test_draft_or_unregistered_lab_course_is_rejected(self):
        self.operation([{"kind": "enroll", "department": CSE}])
        for status in (None, "draft"):
            if status:
                self.publish(status=status)
            r = self.complete(LAB_COURSE)
            self.assertEqual(r.status_code, 400, status)
            self.assertEqual(r.json()["detail"]["code"], "record_change_rejected")
            self.assertEqual(r.json()["detail"]["message"], "아직 체험이 없는 과목이에요.")
        self.assertEqual(self.client.get("/api/me/records").json()["state"]["records"], {})

    def test_lab_on_quiz_course_accepts_pass_but_draft_does_not(self):
        self.operation([{"kind": "enroll", "department": CSE}])
        self.publish(status="draft", subject=QUIZ_COURSE)
        self.assertEqual(self.complete(QUIZ_COURSE, "P").status_code, 400)
        # The theory quiz itself still counts while the lab is a draft.
        self.assertEqual(self.complete(QUIZ_COURSE).status_code, 200)
        self.publish(subject=QUIZ_COURSE)
        self.assertEqual(self.complete(QUIZ_COURSE, "P").status_code, 200)

    def test_new_required_lab_does_not_relock_a_year_opened_before_it(self):
        self.saved_state(self.year2_opened_before_lab())
        self.publish()
        r = self.complete(YEAR2_COURSE)
        self.assertEqual(r.status_code, 200, r.text)
        state = r.json()["state"]
        self.assertTrue(state["exempt"][CSE + "|" + LAB_COURSE])
        self.assertEqual(state["conditions"], 4)

    def test_new_required_lab_locks_students_who_had_not_opened_the_year(self):
        self.saved_state(self.year2_opened_before_lab(quizzes=YEAR1_QUIZZES[:2]))
        self.publish()
        self.assertEqual(self.complete(YEAR1_QUIZZES[2]).status_code, 200)
        r = self.complete(YEAR2_COURSE)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(
            r.json()["detail"]["message"], "입학한 학과의 열린 학년 과목만 저장할 수 있어요."
        )
        self.assertEqual(self.complete(LAB_COURSE).status_code, 200)
        self.assertEqual(self.complete(YEAR2_COURSE).status_code, 200)

    def test_new_account_follows_current_conditions(self):
        self.publish()
        self.operation([{"kind": "enroll", "department": CSE}])
        for subject in YEAR1_QUIZZES:
            self.assertEqual(self.complete(subject).status_code, 200)
        self.assertEqual(self.complete(YEAR2_COURSE).status_code, 400)
        state = self.client.get("/api/me/records").json()["state"]
        self.assertEqual(state["conditions"], 4)
        self.assertEqual(state["exempt"], {})
        # Reset starts over at the current conditions, too.
        self.assertEqual(self.operation([{"kind": "reset"}]).json()["state"]["conditions"], 4)

    def test_guest_import_keeps_years_opened_before_the_lab(self):
        self.publish()
        catalog = main.department_list()["departments"]
        raw = self.year2_opened_before_lab()
        raw["records"][CSE + "|" + YEAR2_COURSE] = earned()
        saved = imported(empty_state(), raw, catalog, 1000)
        self.assertIn(CSE + "|" + YEAR2_COURSE, saved["records"])
        self.assertTrue(saved["exempt"][CSE + "|" + LAB_COURSE])
        # Guests already on the new conditions without the lab are still locked.
        raw["conditions"] = 4
        saved = imported(empty_state(), raw, catalog, 1000)
        self.assertNotIn(CSE + "|" + YEAR2_COURSE, saved["records"])
        self.assertEqual(saved["exempt"], {})

    def test_graduates_keep_graduation_when_a_fourth_year_required_lab_appears(self):
        d = {
            "id": "x",
            "years": {"1": ["a"], "2": ["b"], "3": ["c"], "4": ["f", "g"]},
            "kinds": {"전공필수": ["g"]},
            "games": {},
            "practice": None,
            "final": "f",
        }
        conditions = {
            "version": 4,
            "restored": {},
            "labs": {"x": {"g": {"id": "g-lab", "status": "verified", "since": 4}}},
        }
        state = {**empty_state(), "journeys": {"x": {}}, "records": {"x|f": earned("P")}}
        with patch.object(record_rules, "CONDITIONS", conditions):
            self.assertEqual(grandfather(state, d, 3), {"x|g": True})
            self.assertEqual(grandfather({**state, "records": {}}, d, 3), {})
            self.assertEqual(grandfather(state, d, 4), {})
            guest = {"journeys": {"x": {}}, "records": {"x|f": {"grade": "P"}}, "conditions": 3}
            self.assertEqual(imported(empty_state(), guest, [d], 1000)["exempt"], {"x|g": True})
            guest["conditions"] = 4
            self.assertEqual(imported(empty_state(), guest, [d], 1000)["exempt"], {})


class LabRegistryTest(unittest.TestCase):
    def test_shared_registry_points_at_real_courses(self):
        conditions = record_rules.CONDITIONS
        catalog = {d["id"]: d for d in main.department_list()["departments"]}
        ids = []
        for department, subjects in conditions["labs"].items():
            self.assertIn(department, catalog)
            d = catalog[department]
            for subject, lab in subjects.items():
                self.assertTrue(any(subject in d["years"][y] for y in "1234"), subject)
                self.assertNotIn(subject, (d.get("practice"), d["final"]))
                ids.append(lab["id"])
        self.assertEqual(len(ids), len(set(ids)))

    def test_malformed_registry_stops_the_server(self):
        good = registry()
        self.assertEqual(check_conditions(copy.deepcopy(good)), good)
        lab = good["labs"][CSE][LAB_COURSE]
        for broken in (
            {**lab, "status": "published"},
            {**lab, "since": 5},
            {**lab, "since": 0},
            {**lab, "since": True},
            {**lab, "id": "OOP Class"},
            {**lab, "title": "추가 칸"},
            {"id": lab["id"], "status": "verified"},
        ):
            bad = copy.deepcopy(good)
            bad["labs"][CSE][LAB_COURSE] = broken
            with self.assertRaises(ValueError, msg=broken):
                check_conditions(bad)
        bad = copy.deepcopy(good)
        bad["labs"][CSE][QUIZ_COURSE] = dict(lab)
        with self.assertRaises(ValueError):
            check_conditions(bad)  # 같은 체험 id가 두 과목에
        bad = copy.deepcopy(good)
        bad["restored"][CSE]["이산구조"] = 9
        with self.assertRaises(ValueError):
            check_conditions(bad)
        bad = copy.deepcopy(good)
        del bad["labs"]
        with self.assertRaises(ValueError):
            check_conditions(bad)


if __name__ == "__main__":
    unittest.main()
