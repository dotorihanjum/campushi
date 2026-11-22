"""#36 회원 탈퇴. 세션 소유자 계정만 DB 함수 하나로 지운다(users 삭제 → cascade로 세션·로그인 수단·기록·크레딧 내역).

탈퇴한 소셜·이메일 신원은 user_identities에서 함께 지워지므로, 다시 들어오면 기존 계정이 아니라 새 가입 흐름으로 간다.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, ValidationError
from starlette.concurrency import run_in_threadpool

from backend import accounts, login
from backend.record_rules import passes
from backend.records import document

router = APIRouter(prefix="/api/me/withdraw")
CONFIRM_NEEDED = "탈퇴를 확인해 주세요."


class WithdrawRequest(BaseModel):
    # 지울 계정은 세션 쿠키로만 정한다. user_id 같은 다른 필드는 받지 않는다.
    model_config = ConfigDict(extra="forbid")
    confirm: object = None


def owner(store, request):
    return accounts.current_user(store, request, internal=True)["id"]


@router.get("")
def withdraw_summary(request: Request, store=Depends(accounts.account_store)):
    """탈퇴 확인 화면용 요약. 크레딧은 지급 원장 합계, 나머지는 계정 기록 문서에서 센다."""
    user_id = owner(store, request)
    state = document(store, user_id)["state"]
    try:
        credits = int(login.rpc(store, "account_credit_balance", {"p_user_id": user_id}))
        records = state.get("records") or {}
        return {
            "credits": credits,
            "departments": len(state.get("journeys") or {}),
            "courses": len(records),
            "passed": sum(1 for r in records.values() if isinstance(r, dict) and passes(r.get("grade"))),
            "notes": sum(1 for text in (state.get("notes") or {}).values() if isinstance(text, str) and text.strip()),
            "profile": bool(state.get("nickname") or state.get("profilePhoto")),
        }
    except (TypeError, ValueError, AttributeError):
        accounts.logger.error("탈퇴 요약을 만들 계정 기록 형식이 예상과 다릅니다.")
        raise accounts.AccountError(502, accounts.BAD_REPLY) from None


@router.post("")
async def withdraw(request: Request, store=Depends(accounts.account_store)):
    # 본문을 읽기 전에 Origin·Content-Type부터 확인한다(다른 사이트의 요청은 형식과 상관없이 403).
    login.same_origin(request)
    try:
        body = WithdrawRequest.model_validate(await request.json())
    except (ValueError, ValidationError):
        raise HTTPException(400, CONFIRM_NEEDED) from None
    if body.confirm is not True:
        raise HTTPException(400, CONFIRM_NEEDED)
    return await run_in_threadpool(delete_owner, store, request)


def delete_owner(store, request):
    user_id = owner(store, request)
    token = request.cookies.get(accounts.SESSION_COOKIE)
    # 함수가 세션 해시와 사용자를 함께 확인하므로, 조회와 삭제 사이에 세션이 끝났으면 아무것도 지우지 않고 False다.
    if login.rpc(store, "delete_account", {"p_user_id": user_id, "p_token_hash": accounts.hash_token(token)}) is not True:
        raise accounts.AccountError(401, accounts.SESSION_ENDED, clear_cookie=True)
    response = JSONResponse({"withdrawn": True})
    accounts.clear_session_cookie(response)
    from backend.signup import REGISTRATION

    for name in (login.FLOW, login.PENDING, REGISTRATION):
        login.clear_ticket(response, name)
    return response
