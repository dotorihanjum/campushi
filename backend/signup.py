"""#32: 인증된 신원도 나이·필수 동의를 통과하기 전에는 users에 저장하지 않는다."""
import os
from datetime import datetime
from typing import Literal
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from fastapi import Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from backend import accounts, login

REGISTRATION = "__Host-campushi_registration"
DEFAULT_TERMS_URL = "https://example.com/terms"
DEFAULT_PRIVACY_URL = "https://example.com/privacy"
DEFAULT_POLICY_VERSION = "development-placeholder-v1"
SIGNUP_UNAVAILABLE = "신규 가입을 준비하고 있어요. 기존 계정으로 로그인하거나 체험을 계속할 수 있어요."


def current_year():
    return datetime.now(ZoneInfo("Asia/Seoul")).year


def eligible_year(year, now_year=None):
    return type(year) is int and 1900 <= year <= (now_year or current_year()) - 15


def registration_policy():
    terms = os.getenv("AUTH_TERMS_URL", "").strip() or DEFAULT_TERMS_URL
    privacy = os.getenv("AUTH_PRIVACY_URL", "").strip() or DEFAULT_PRIVACY_URL
    version = os.getenv("AUTH_TERMS_VERSION", "").strip() or DEFAULT_POLICY_VERSION
    production = os.getenv("VERCEL_ENV") == "production"
    placeholder = version.casefold().startswith("development-placeholder")
    try:
        for url in (terms, privacy):
            parsed = urlsplit(url)
            host = (parsed.hostname or "").rstrip(".")
            if parsed.scheme != "https" or not host or parsed.username or parsed.password or any(c.isspace() for c in url):
                raise ValueError("Invalid policy URL")
            placeholder |= any(host == sample or host.endswith("." + sample)
                               for sample in ("example.com", "example.net", "example.org", "localhost"))
            if production and host.endswith((".example", ".invalid", ".test")):
                placeholder = True
        if not 1 <= len(version) <= 80:
            raise ValueError("Invalid policy version")
    except ValueError:
        if production:
            return None
        raise HTTPException(503, "약관 링크와 버전 설정을 확인해 주세요.") from None
    if production and placeholder:
        return None
    return {"version": version, "terms_url": terms, "privacy_url": privacy, "placeholder": placeholder}


class SignupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    birth_year: int = Field(strict=True, ge=1900, le=9999)
    role: Literal["student", "mentor"]
    terms_agreed: bool = Field(strict=True)
    privacy_agreed: bool = Field(strict=True)
    policy_version: str = Field(min_length=1, max_length=80)


def age_denial(request, store=None):
    response = JSONResponse(status_code=403, content={"detail": "만 14세 이상부터 가입할 수 있어요. 학과 체험은 로그인 없이 계속할 수 있어요.", "code": "signup_age_restricted"})
    # 거부된 신원 증명은 재사용할 수 없게 소비하고, 진행 중인 다른 인증도 취소한다.
    login.discard_pending(request, response, store)
    login.clear_ticket(response, REGISTRATION)
    return response


def check_consent(body):
    policy = registration_policy()
    if policy is None:
        raise HTTPException(503, SIGNUP_UNAVAILABLE)
    if not body.terms_agreed or not body.privacy_agreed:
        raise HTTPException(400, "필수 약관을 확인하고 동의해 주세요.")
    if body.policy_version != policy["version"]:
        raise HTTPException(409, "약관이 변경됐어요. 화면을 새로 열어 확인해 주세요.")
    return policy


@login.router.post("/eligibility")
def eligibility(body: SignupRequest, request: Request, response: Response):
    login.same_origin(request)
    check_consent(body)
    if not eligible_year(body.birth_year):
        return age_denial(request)
    login.set_ticket(response, REGISTRATION, "registration", body.model_dump())
    return {"eligible": True}


@login.router.post("/register")
def register(body: SignupRequest, request: Request, response: Response, store=Depends(accounts.account_store)):
    login.same_origin(request)
    policy = check_consent(body)
    if not eligible_year(body.birth_year):
        return age_denial(request, store)
    pending = login.unseal(request.cookies.get(login.PENDING), "signup")
    identity = pending["identity"]
    if login.matching_account(store, identity):
        raise HTTPException(409, "같은 이메일의 기존 계정으로 다시 로그인해 연결해 주세요.")
    data = login.rpc(store, "register_login_account", {"p_provider": identity["provider"], "p_subject": identity["subject"], "p_email": identity["email"],
        "p_birth_year": body.birth_year, "p_role": body.role, "p_terms_version": policy["version"],
        "p_proof_hash": accounts.hash_token(pending["nonce"])})
    accounts.create_session(store, response, data["id"])
    login.clear_ticket(response, login.PENDING)
    login.clear_ticket(response, REGISTRATION)
    return {"user": {k: data[k] for k in accounts.PUBLIC_FIELDS}, "return_to": pending["return_to"]}
