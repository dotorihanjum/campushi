"""Session-scoped account storage. Writes are validated then atomically compared and committed."""

import hmac
import time
from uuid import UUID
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from backend import accounts
from backend.login import signing_key, same_origin
from backend.record_rules import empty_state, imported, apply_operation, available, course, upgraded

router = APIRouter(prefix="/api/me/records")


class ImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation_id: UUID
    scope: str = Field(min_length=64, max_length=64)
    state: dict


class OperationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation_id: UUID
    scope: str = Field(min_length=64, max_length=64)
    changes: list[dict] = Field(min_length=1, max_length=20)


def owner(store, request):
    user = accounts.current_user(store, request, internal=True)
    return user["id"], hmac.digest(
        signing_key(), ("account-records:" + user["id"]).encode(), "sha256"
    ).hex()


def document(store, user_id):
    rows = store.call(
        "GET",
        "account_records",
        params={"user_id": "eq." + user_id, "select": "revision,state", "limit": "1"},
    ).json()
    return rows[0] if rows else {"revision": 0, "state": empty_state()}


def public_document(doc, scope):
    return {
        "scope": scope,
        "revision": doc["revision"],
        "state": {**empty_state(), **doc["state"]},
    }


def commit(store, user_id, operation_id, change):
    doc = document(store, user_id)
    for _ in range(5):
        replay = store.call(
            "GET",
            "record_operations",
            params={
                "user_id": "eq." + user_id,
                "operation_id": "eq." + str(operation_id),
                "select": "operation_id",
                "limit": "1",
            },
        ).json()
        if replay:
            return document(store, user_id)
        state, awards = change({**empty_state(), **doc["state"]})
        saved = store.call(
            "POST",
            "rpc/commit_account_records",
            body={
                "p_user_id": user_id,
                "p_revision": doc["revision"],
                "p_operation_id": str(operation_id),
                "p_state": state,
                "p_awards": awards,
            },
        ).json()
        if saved["status"] != "conflict":
            return saved
        doc = saved
    raise HTTPException(
        409, "다른 기기에서 기록을 저장 중이에요. 잠시 후 다시 시도해 주세요."
    )


class AttemptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    department: str = Field(min_length=1, max_length=100)
    subject: str = Field(min_length=1, max_length=200)


@router.post("/attempts")
def start_attempt(
    body: AttemptRequest, request: Request, store=Depends(accounts.account_store)
):
    """#97 수업을 열 때 그 과목의 체험 시도를 발급한다. 이 번호로 마친 이수에만 크레딧을 준다."""
    same_origin(request)
    user_id, _ = owner(store, request)
    from backend.main import department_list

    state = {**empty_state(), **document(store, user_id)["state"]}
    catalog = department_list()["departments"]
    d, key = course(upgraded(state, catalog), catalog, body.department, body.subject)
    if not available(d, body.subject):
        raise HTTPException(400, "아직 체험이 없는 과목이에요.")
    attempt = store.call(
        "POST",
        "rpc/start_lesson_attempt",
        body={"p_user_id": user_id, "p_course_key": key},
    ).json()
    if not attempt:
        raise HTTPException(429, "체험을 너무 자주 시작했어요. 잠시 뒤에 다시 해 주세요.")
    return {"attempt": attempt}


@router.get("")
def get_records(request: Request, store=Depends(accounts.account_store)):
    user_id, scope = owner(store, request)
    return public_document(document(store, user_id), scope)


@router.post("/import")
def import_records(
    body: ImportRequest, request: Request, store=Depends(accounts.account_store)
):
    same_origin(request)
    user_id, scope = owner(store, request)
    if not hmac.compare_digest(scope, body.scope):
        raise HTTPException(409, {"code": "record_account_changed", "message": "로그인한 계정이 바뀌었어요. 다시 확인해 주세요."})
    from backend.main import department_list

    raw = body.state
    if any(
        not isinstance(raw.get(key, {}), dict)
        for key in ("journeys", "records", "notes")
    ):
        raise HTTPException(400, "가져올 기록을 확인해 주세요.")
    catalog = department_list()["departments"]
    now = int(time.time() * 1000)
    saved = commit(
        store, user_id, body.operation_id,
        lambda state: (imported(state, raw, catalog, now), []),
    )
    confirmed_journeys = saved["state"].get("journeys", {})
    count = sum(
        department["id"] in raw.get("journeys", {}) and department["id"] in confirmed_journeys
        for department in catalog
    )
    return {**public_document(saved, scope), "imported_department_count": count}


@router.post("/operations")
def save_operations(
    body: OperationRequest, request: Request, store=Depends(accounts.account_store)
):
    same_origin(request)
    user_id, scope = owner(store, request)
    if not hmac.compare_digest(scope, body.scope):
        raise HTTPException(409, {"code": "record_account_changed", "message": "로그인한 계정이 바뀌었어요. 다시 확인해 주세요."})
    # Check replay before running rules (e.g. a repeated profile update has an old expected revision).
    replay = store.call(
        "GET",
        "record_operations",
        params={
            "user_id": "eq." + user_id,
            "operation_id": "eq." + str(body.operation_id),
            "select": "operation_id",
            "limit": "1",
        },
    ).json()
    if replay:
        return public_document(document(store, user_id), scope)
    from backend.main import department_list

    now = int(time.time() * 1000)
    catalog = department_list()["departments"]

    def change(state):
        awards = []
        for index, op in enumerate(body.changes):
            try:
                state, new_awards = apply_operation(state, op, catalog, now)
            except HTTPException as error:
                if error.status_code not in (400, 409):
                    raise
                # This batch is still uncommitted. The browser can retry its other changes.
                raise HTTPException(error.status_code, {
                    "code": "record_change_rejected",
                    "change_index": index,
                    "message": error.detail,
                }) from None
            awards.extend(new_awards)
        return state, awards

    return public_document(commit(store, user_id, body.operation_id, change), scope)
