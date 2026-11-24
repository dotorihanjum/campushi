import copy
import io
import time
import base64
import unittest
from unittest.mock import patch
from uuid import uuid4
import httpx
from PIL import Image
from fastapi.testclient import TestClient
from backend import accounts, main, records
from backend.record_rules import empty_state, imported, photo
from backend.test_login import ENV, HEADERS, USER


class RecordStore:
    """Fake Supabase for records. commit_account_records follows the SQL: credits come from a ledger, and each grant
    needs an unused attempt of the same user and course that started 20 seconds to a day ago (#97)."""

    def __init__(self):
        self.docs = {}
        self.operations = set()
        self.conflicts = 0
        self.attempts = {}
        self.ledger = []
        self.attempt_limit = 60
        # Seconds since a new attempt "started". Tests that finish too fast set this below 20.
        self.attempt_age = 30

    def grant(self, owner, operation_id, award):
        now = time.time()
        if any(row[0] == owner and row[1] == award["course_key"] and row[2] > award["awarded_at"] - 604800000 for row in self.ledger):
            return
        attempt = self.attempts.get(award.get("attempt_id"))
        if (
            not attempt
            or attempt["user"] != owner
            or attempt["course_key"] != award["course_key"]
            or attempt["used_by"]
            or not now - 86400 < attempt["started"] <= now - 20
        ):
            return
        attempt["used_by"] = operation_id
        self.ledger.append((owner, award["course_key"], award["awarded_at"]))

    def call(self, method, table, params=None, body=None, prefer=None):
        if table == "rpc/start_lesson_attempt":
            mine = [a for a in self.attempts.values() if a["user"] == body["p_user_id"]]
            if len(mine) >= self.attempt_limit:
                return httpx.Response(200, content=b"null", headers={"content-type": "application/json"})
            id = str(uuid4())
            self.attempts[id] = {"user": body["p_user_id"], "course_key": body["p_course_key"], "started": time.time() - self.attempt_age, "used_by": None}
            return httpx.Response(200, json=id)
        if table == "record_operations":
            return httpx.Response(
                200,
                json=[{"operation_id": params["operation_id"][3:]}]
                if (params["user_id"][3:], params["operation_id"][3:])
                in self.operations
                else [],
            )
        if table == "account_records":
            value = self.docs.get(params["user_id"][3:])
            return httpx.Response(200, json=[value] if value else [])
        if table == "rpc/commit_account_records":
            owner = body["p_user_id"]
            doc = self.docs.get(owner, {"revision": 0, "state": empty_state()})
            key = (owner, body["p_operation_id"])
            if key in self.operations:
                return httpx.Response(200, json={**doc, "status": "duplicate"})
            if self.conflicts:
                self.conflicts -= 1
                doc = {**doc, "revision": doc["revision"] + 1}
                self.docs[owner] = doc
            if body["p_revision"] != doc["revision"]:
                return httpx.Response(200, json={**doc, "status": "conflict"})
            self.operations.add(key)
            for award in body.get("p_awards", []):
                self.grant(owner, body["p_operation_id"], award)
            state = copy.deepcopy(body["p_state"])
            mine = [row for row in self.ledger if row[0] == owner]
            state["credits"] = 5 * len(mine)
            state["creditedAt"] = {}
            for _, course_key, at in mine:
                state["creditedAt"][course_key] = max(at, state["creditedAt"].get(course_key, 0))
            doc = {"revision": doc["revision"] + 1, "state": state}
            self.docs[owner] = doc
            return httpx.Response(200, json={**doc, "status": "saved"})
        raise AssertionError(table)


class RecordTest(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict("os.environ", ENV, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.store = RecordStore()
        main.app.dependency_overrides[accounts.account_store] = lambda: self.store
        self.addCleanup(main.app.dependency_overrides.clear)
        self.identity = patch.object(accounts, "current_user", return_value=USER)
        self.identity.start()
        self.addCleanup(self.identity.stop)
        self.client = TestClient(main.app, base_url="https://testserver")
        self.scope = self.client.get("/api/me/records").json()["scope"]
        self.catalog = main.department_list()["departments"]
        self.id = "khu-cse"
        self.subject = next(
            s for s in self.catalog[0]["years"]["1"] if s in self.catalog[0]["games"]
        )

    def guest(self):
        return {
            "nickname": "로컬 학생",
            "journeys": {self.id: {}},
            "records": {
                self.id + "|" + self.subject: {
                    "grade": "A+",
                    "percent": 100,
                    "attempts": 2,
                }
            },
            "credits": 999999,
            "creditedAt": {self.id + "|" + self.subject: 1},
        }

    def import_request(self, body=None, operation_id=None):
        return self.client.post(
            "/api/me/records/import",
            json={
                "scope": self.scope,
                "operation_id": operation_id or str(uuid4()),
                "state": body or self.guest(),
            },
            headers=HEADERS,
        )

    def test_import_is_persisted_without_browser_credits_and_retry_is_idempotent(self):
        op = str(uuid4())
        r = self.import_request(operation_id=op)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["state"]["credits"], 0)
        self.assertEqual(r.json()["state"]["creditedAt"], {})
        self.assertEqual(
            r.json()["state"]["records"][self.id + "|" + self.subject]["source"],
            "imported",
        )
        self.assertEqual(self.import_request(operation_id=op).json()["revision"], 1)
        self.assertEqual(
            self.client.get("/api/me/records").json()["state"]["nickname"], "로컬 학생"
        )

    def test_unknown_locked_or_malformed_import_rows_are_dropped(self):
        raw = self.guest()
        d = self.catalog[0]
        locked = d["years"]["4"][0]
        raw["journeys"]["forged"] = {}
        raw["records"][self.id + "|" + locked] = {
            "grade": "A+",
            "percent": 100,
            "attempts": 1,
        }
        raw["records"]["forged|bad"] = {"grade": "P"}
        raw["records"][self.id + "|" + self.subject]["percent"] = 20
        saved = self.import_request(raw).json()["state"]
        self.assertNotIn("forged", saved["journeys"])
        self.assertEqual(saved["records"], {})

    def test_wrong_scope_and_origin_denied(self):
        self.scope = "0" * 64
        self.assertEqual(self.import_request().status_code, 409)
        self.assertEqual(
            self.client.post(
                "/api/me/records/import",
                json={"scope": self.scope, "operation_id": str(uuid4()), "state": {}},
            ).status_code,
            403,
        )

    def test_compare_and_swap_retries_without_losing_server_revision(self):
        self.store.conflicts = 1
        self.assertEqual(self.import_request().json()["revision"], 2)

    def test_photo_decoder_rejects_html_svg_and_oversized_dimensions(self):
        for value in [
            "javascript:alert(1)",
            "data:image/svg+xml;base64,PHN2Zz4=",
            "data:image/jpeg;base64,PHNjcmlwdD4=",
        ]:
            with self.assertRaises(Exception):
                photo(value)
        img = Image.new("RGB", (256, 256), "teal")
        out = io.BytesIO()
        img.save(out, format="JPEG")
        value = "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode()
        self.assertTrue(photo(value).startswith("data:image/jpeg;base64,"))
        raw = self.guest()
        raw["profilePhoto"] = value
        self.assertEqual(self.import_request(raw).status_code, 200)

    def attempt(self, subject=None, department=None):
        r = self.client.post(
            "/api/me/records/attempts",
            json={"department": department or self.id, "subject": subject or self.subject},
            headers=HEADERS,
        )
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["attempt"]

    def operation(self, changes, operation_id=None):
        return self.client.post(
            "/api/me/records/operations",
            json={
                "scope": self.scope,
                "operation_id": operation_id or str(uuid4()),
                "changes": changes,
            },
            headers=HEADERS,
        )

    def test_live_pass_after_import_grants_once_and_retries_do_not_increase_attempts(
        self,
    ):
        self.import_request()
        op = str(uuid4())
        changes = [
            {
                "kind": "complete",
                "department": self.id,
                "subject": self.subject,
                "score": {"correct": 10, "total": 10},
                "note": "내 기록",
                "attempt": self.attempt(),
            }
        ]
        first = self.operation(changes, op)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.json()["state"]["credits"], 5)
        again = self.operation(changes, op).json()["state"]
        self.assertEqual(again["credits"], 5)
        self.assertEqual(again["records"][self.id + "|" + self.subject]["attempts"], 3)
        next_attempt = self.operation([{**changes[0], "attempt": self.attempt()}]).json()["state"]
        self.assertEqual(next_attempt["credits"], 5)
        self.assertEqual(
            next_attempt["records"][self.id + "|" + self.subject]["attempts"], 4
        )

    def test_two_devices_merge_attempts_and_keep_the_better_grade(self):
        self.import_request()
        for correct in (7, 9):
            result = self.operation(
                [
                    {
                        "kind": "complete",
                        "department": self.id,
                        "subject": self.subject,
                        "score": {"correct": correct, "total": 10},
                    }
                ]
            )
            self.assertEqual(result.status_code, 200, result.text)
        row = result.json()["state"]["records"][self.id + "|" + self.subject]
        self.assertEqual(row["attempts"], 4)
        self.assertEqual(row["grade"], "A+")

    def test_clients_cannot_assign_balance_or_arbitrary_unlocks(self):
        r = self.operation(
            [
                {
                    "kind": "preferences",
                    "campus": "khu-global",
                    "studying": None,
                    "credits": 1000,
                }
            ]
        )
        self.assertEqual(r.status_code, 400)
        r = self.operation(
            [
                {
                    "kind": "complete",
                    "department": self.id,
                    "subject": self.catalog[0]["final"],
                    "score": "P",
                }
            ]
        )
        self.assertEqual(r.status_code, 400)
        r = self.operation(
            [
                {"kind": "enroll", "department": self.id},
                {
                    "kind": "complete",
                    "department": self.id,
                    "subject": self.subject,
                    "score": "P",
                },
            ]
        )
        self.assertEqual(r.status_code, 400)
        self.assertEqual(
            self.client.get("/api/me/records").json()["state"]["journeys"], {}
        )

    def test_profile_conflict_keeps_existing_server_profile(self):
        first = self.operation(
            [{"kind": "profile", "nickname": "학생 A", "photo": None, "expected": 0}]
        )
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(
            self.operation(
                [
                    {
                        "kind": "profile",
                        "nickname": "학생 B",
                        "photo": None,
                        "expected": 0,
                    }
                ]
            ).status_code,
            409,
        )
        self.assertEqual(
            self.client.get("/api/me/records").json()["state"]["nickname"], "학생 A"
        )

    def test_leave_and_reset_keep_server_credit_history(self):
        self.import_request()
        self.operation(
            [
                {
                    "kind": "complete",
                    "department": self.id,
                    "subject": self.subject,
                    "score": {"correct": 10, "total": 10},
                    "attempt": self.attempt(),
                }
            ]
        )
        saved = self.operation([{"kind": "leave", "department": self.id}]).json()[
            "state"
        ]
        self.assertEqual(saved["records"], {})
        self.assertEqual(saved["credits"], 5)
        self.assertTrue(saved["creditedAt"])
        saved = self.operation([{"kind": "reset"}]).json()["state"]
        self.assertEqual(saved["credits"], 5)
        self.assertEqual(saved["nickname"], "")

    def test_legacy_unlocked_years_are_restored_only_for_known_restored_courses(self):
        raw = self.guest()
        raw["conditions"] = 2
        raw["records"][self.id + "|신호와시스템"] = {
            "grade": "A+",
            "percent": 100,
            "attempts": 1,
        }
        raw["exempt"] = {self.id + "|알고리즘": True}
        saved = self.import_request(raw).json()["state"]
        self.assertIn(self.id + "|신호와시스템", saved["records"])
        self.assertNotIn(self.id + "|알고리즘", saved["exempt"])
        # Already normalized legacy browser data keeps its server-known exceptions too.
        raw["conditions"] = 3
        raw["exempt"] = saved["exempt"]
        self.assertIn(
            self.id + "|신호와시스템",
            self.import_request(raw).json()["state"]["records"],
        )

    def test_nested_wrong_types_are_rejected_without_a_server_exception(self):
        for operation in (
            {"kind": []},
            {"kind": "enroll", "department": []},
            {"kind": "preferences", "campus": "khu-global", "studying": []},
        ):
            self.assertEqual(self.operation([operation]).status_code, 400)

    def test_session_owner_isolates_another_account(self):
        self.import_request()
        with patch.object(
            accounts,
            "current_user",
            return_value={**USER, "id": "00000000-0000-0000-0000-000000000002"},
        ):
            self.assertEqual(
                self.client.get("/api/me/records").json()["state"]["nickname"], ""
            )
            self.assertEqual(self.import_request().status_code, 409)
        with patch.object(
            accounts,
            "current_user",
            side_effect=accounts.AccountError(401, "로그인이 필요해요."),
        ):
            self.assertEqual(self.client.get("/api/me/records").status_code, 401)

    def pass_course(self, **extra):
        change = {"kind": "complete", "department": self.id, "subject": self.subject, "score": {"correct": 10, "total": 10}}
        r = self.operation([{**change, **extra}])
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["state"]

    def test_97_complete_without_server_attempt_saves_grade_but_no_credit(self):
        self.operation([{"kind": "enroll", "department": self.id}])
        state = self.pass_course()
        self.assertEqual(state["records"][self.id + "|" + self.subject]["grade"], "A+")
        self.assertEqual(state["credits"], 0)
        self.assertEqual(state["creditedAt"], {})
        # A made-up attempt number is not an attempt either.
        self.assertEqual(self.pass_course(attempt=str(uuid4()))["credits"], 0)
        # A malformed one is rejected as a bad change.
        r = self.operation([{"kind": "complete", "department": self.id, "subject": self.subject,
                             "score": {"correct": 10, "total": 10}, "attempt": "not-an-attempt"}])
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["detail"]["code"], "record_change_rejected")

    def test_97_attempt_must_be_this_users_this_courses_unused_and_not_too_fast(self):
        self.operation([{"kind": "enroll", "department": self.id}])
        other = next(s for s in self.catalog[0]["years"]["1"] if s in self.catalog[0]["games"] and s != self.subject)
        # Another course's attempt does not pay for this course.
        self.assertEqual(self.pass_course(attempt=self.attempt(other))["credits"], 0)
        # Another account's attempt does not pay either.
        stolen = self.attempt()
        self.store.attempts[stolen]["user"] = "00000000-0000-0000-0000-000000000002"
        self.assertEqual(self.pass_course(attempt=stolen)["credits"], 0)
        # Finishing within 20 seconds of opening the lesson earns nothing and leaves the attempt unused.
        self.store.attempt_age = 5
        quick = self.attempt()
        self.assertEqual(self.pass_course(attempt=quick)["credits"], 0)
        self.assertIsNone(self.store.attempts[quick]["used_by"])
        self.store.attempts[quick]["started"] -= 30
        op = str(uuid4())
        r = self.operation([{"kind": "complete", "department": self.id, "subject": self.subject,
                             "score": {"correct": 10, "total": 10}, "attempt": quick}], op)
        self.assertEqual(r.json()["state"]["credits"], 5)
        self.assertEqual(self.store.attempts[quick]["used_by"], op)
        # A failing grade earns nothing even with an attempt.
        state = self.operation([{"kind": "complete", "department": self.id, "subject": other,
                                 "score": {"correct": 1, "total": 10}, "attempt": self.attempt(other)}]).json()["state"]
        self.assertEqual(state["credits"], 5)

    def test_97_attempts_are_issued_only_for_open_courses_with_an_experience(self):
        post = lambda body, headers=HEADERS: self.client.post("/api/me/records/attempts", json=body, headers=headers)
        # Not enrolled yet.
        r = post({"department": self.id, "subject": self.subject})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["detail"], "입학한 학과의 열린 학년 과목만 저장할 수 있어요.")
        self.operation([{"kind": "enroll", "department": self.id}])
        cse = self.catalog[0]
        planned = next(s for s in cse["years"]["1"] if s not in cse["games"] and s not in (cse.get("practice"), cse["final"]))
        self.assertEqual(post({"department": self.id, "subject": planned}).json()["detail"], "아직 체험이 없는 과목이에요.")
        locked = cse["years"]["4"][0]
        self.assertEqual(post({"department": self.id, "subject": locked}).status_code, 400)
        self.assertEqual(post({"department": self.id, "subject": self.subject, "extra": 1}).status_code, 400)
        self.assertEqual(post({"department": self.id, "subject": self.subject}, {"origin": "https://evil.example"}).status_code, 403)
        # Too many starts in an hour.
        self.store.attempt_limit = 0
        r = post({"department": self.id, "subject": self.subject})
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.json()["detail"], "체험을 너무 자주 시작했어요. 잠시 뒤에 다시 해 주세요.")

    def test_credit_cooldown_uses_server_time_for_each_course(self):
        from backend.record_rules import apply_operation

        state = imported(empty_state(), self.guest(), self.catalog, 1000000000000)
        op = {
            "kind": "complete",
            "department": self.id,
            "subject": self.subject,
            "score": {"correct": 10, "total": 10},
            "attempt": str(uuid4()),
        }
        state, awards = apply_operation(state, op, self.catalog, 1000000000000)
        self.assertEqual(awards[0]["attempt_id"], op["attempt"])
        self.assertEqual(state["credits"], 5)
        state, awards = apply_operation(
            state, op, self.catalog, 1000000000000 + 6 * 86400000
        )
        self.assertEqual(state["credits"], 5)
        self.assertEqual(awards, [])
        state, awards = apply_operation(
            state, op, self.catalog, 1000000000000 + 7 * 86400000
        )
        self.assertEqual(state["credits"], 10)
        self.assertEqual(len(awards), 1)


    def test_import_count_excludes_existing_unrelated_and_unknown_departments(self):
        other = next(d["id"] for d in self.catalog if d["id"] != self.id)
        self.assertEqual(self.operation([{"kind": "enroll", "department": other}]).status_code, 200)
        raw = self.guest()
        raw["journeys"]["unknown"] = {}
        operation_id = str(uuid4())
        for _ in range(2):
            result = self.import_request(raw, operation_id).json()
            self.assertEqual(result["imported_department_count"], 1)
            self.assertEqual(set(result["state"]["journeys"]), {self.id, other})

    def test_failed_change_is_identified_without_committing_its_batch(self):
        changes = [
            {"kind": "enroll", "department": self.id},
            {"kind": "complete", "department": self.id, "subject": "없는 과목", "score": "P"},
        ]
        operation_id = str(uuid4())
        response = self.operation(changes, operation_id)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["code"], "record_change_rejected")
        self.assertEqual(response.json()["detail"]["change_index"], 1)
        self.assertEqual(self.client.get("/api/me/records").json()["state"]["journeys"], {})
        self.assertEqual(self.operation(changes[:1], operation_id).status_code, 200)

    def test_save_contention_is_not_an_item_rejection(self):
        self.store.conflicts = 5
        response = self.operation([{"kind": "enroll", "department": self.id}])
        self.assertEqual(response.status_code, 409)
        self.assertIsInstance(response.json()["detail"], str)
