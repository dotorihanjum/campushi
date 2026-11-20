"""#31: 인증은 제공자/메일로, 계정과 세션은 기존 accounts.py로 관리한다."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import smtplib
import ssl
import time
from datetime import datetime, timezone
from email.message import EmailMessage
from functools import lru_cache
from urllib.parse import parse_qs, urlencode, urlsplit

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from backend import accounts

router = APIRouter(prefix="/api/auth")
FLOW = "__Host-campushi_login_flow"
PENDING = "__Host-campushi_signup"
TTL = 600
VIEWS = {"my", "home", "experience", "community"}
NAMES = {"google": "구글", "kakao": "카카오", "apple": "Apple", "email": "이메일"}
PROVIDERS = {
    "google": ("https://accounts.google.com/o/oauth2/v2/auth", "https://oauth2.googleapis.com/token"),
    "kakao": ("https://kauth.kakao.com/oauth/authorize", "https://kauth.kakao.com/oauth/token"),
    "apple": ("https://appleid.apple.com/auth/authorize", "https://appleid.apple.com/auth/token"),
}


def app_origin(request):
    configured = os.getenv("AUTH_BASE_URL", "").rstrip("/")
    if configured:
        parts = urlsplit(configured)
        if parts.scheme != "https" or not parts.hostname or parts.username or parts.password or parts.path or parts.query or parts.fragment:
            raise HTTPException(503, "로그인 주소 설정을 확인해 주세요.")
        return configured
    if request.url.hostname in ("127.0.0.1", "localhost") and not os.getenv("VERCEL"):
        return str(request.base_url).rstrip("/")
    raise HTTPException(503, "로그인 주소 설정을 준비하고 있어요.")


def same_origin(request):
    if request.headers.get("origin") != app_origin(request) or request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "현재 화면에서 다시 시도해 주세요.")
    if request.headers.get("content-type", "").split(";")[0] != "application/json":
        raise HTTPException(415, "지원하지 않는 요청 형식이에요.")


def b64(raw):
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def signing_key():
    key = os.getenv("AUTH_COOKIE_SECRET", "") or os.getenv("SUPABASE_SECRET_KEY", "")
    if len(key) < 32:
        raise HTTPException(503, "로그인 보안 설정을 준비하고 있어요.")
    return hmac.digest(key.encode(), b"campushi-login-ticket-v1", "sha256")


def seal(kind, data):
    payload = b64(json.dumps({**data, "kind": kind, "exp": int(time.time()) + TTL}, separators=(",", ":")).encode())
    return payload + "." + b64(hmac.digest(signing_key(), payload.encode(), "sha256"))


def unseal(value, kind):
    try:
        payload, signature = value.split(".")
        if len(value) > 3600 or not hmac.compare_digest(signature, b64(hmac.digest(signing_key(), payload.encode(), "sha256"))):
            raise ValueError()
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if data["kind"] != kind or type(data["exp"]) is not int or data["exp"] <= time.time():
            raise ValueError()
        return data
    except (ValueError, TypeError, KeyError, AttributeError):
        raise HTTPException(401, "인증 시간이 지났어요. 로그인부터 다시 시도해 주세요.") from None


def set_ticket(response, name, kind, data, *, apple=False):
    response.set_cookie(name, seal(kind, data), max_age=TTL, secure=True, httponly=True, samesite="none" if apple else "lax", path="/")


def clear_ticket(response, name):
    response.delete_cookie(name, secure=True, httponly=True, samesite="lax", path="/")


def body_of(reply):
    try:
        return reply.json()
    except (ValueError, TypeError):
        raise HTTPException(502, "인증 서버 응답을 확인하지 못했어요.") from None


def rpc(store, name, data):
    return body_of(store.call("POST", "rpc/" + name, body=data))


def identity_for(store, identity):
    rows = body_of(store.call("GET", "user_identities", params={"select": "user:users(id," + ",".join(accounts.PUBLIC_FIELDS) + ")", "provider": "eq." + identity["provider"], "provider_user_id": "eq." + identity["subject"], "limit": "1"}))
    return rows[0]["user"] if rows else None


def matching_account(store, identity):
    if not identity.get("email"):
        return None
    rows = rpc(store, "find_login_account", {"p_email": identity["email"]})
    if len(rows) > 1:
        raise HTTPException(409, "같은 이메일의 계정이 여러 개 있어요. 기존에 사용한 로그인 방식으로 로그인해 주세요.")
    return rows[0] if rows else None


def enabled_providers(request):
    try:
        origin = app_origin(request)
        signing_key()
        accounts.store_from_env()
    except HTTPException:
        return [], False, False
    providers = [p for p in PROVIDERS if os.getenv(p.upper() + "_CLIENT_ID") and os.getenv(p.upper() + "_CLIENT_SECRET") and (p != "apple" or origin.startswith("https:"))]
    email = all(os.getenv(k) for k in ("SMTP_HOST", "SMTP_FROM", "SMTP_USERNAME", "SMTP_PASSWORD"))
    return providers, bool(email), True


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider: str
    return_to: str = "my"
    link: bool = False


def flow_context(request, body, store):
    if body.return_to not in VIEWS:
        raise HTTPException(400, "돌아갈 화면을 확인해 주세요.")
    flow = {"provider": body.provider, "return_to": body.return_to, "state": secrets.token_urlsafe(32), "nonce": secrets.token_urlsafe(32)}
    if body.link:
        pending = unseal(request.cookies.get(PENDING), "signup")
        target = matching_account(store, pending["identity"])
        if not target or target["provider"] != body.provider:
            raise HTTPException(400, "기존 계정의 로그인 방식으로 다시 인증해 주세요.")
        flow["link_user"] = target["id"]
        flow["link_pending"] = pending["nonce"]
    return flow


@router.get("/options")
def options(request: Request):
    providers, email, configured = enabled_providers(request)
    from backend.signup import registration_policy, current_year
    return {"providers": providers, "email": email, "configured": configured, "policy": registration_policy(), "year": current_year()}


@router.post("/start")
def start(body: LoginRequest, request: Request, response: Response, store=Depends(accounts.account_store)):
    same_origin(request)
    if body.provider not in enabled_providers(request)[0]:
        raise HTTPException(503, "지금은 이 로그인 방식을 사용할 수 없어요.")
    flow = flow_context(request, body, store)
    origin = app_origin(request)
    callback = origin + "/api/auth/callback/" + body.provider
    query = {"response_type": "code", "client_id": os.environ[body.provider.upper() + "_CLIENT_ID"], "redirect_uri": callback, "state": flow["state"]}
    if body.provider == "google":
        flow["verifier"] = secrets.token_urlsafe(48)
        query.update(scope="openid email", prompt="select_account", code_challenge=b64(hashlib.sha256(flow["verifier"].encode()).digest()), code_challenge_method="S256", nonce=flow["nonce"])
    elif body.provider == "apple":
        query.update(scope="email", response_mode="form_post", nonce=flow["nonce"])
    else:
        query["prompt"] = "login" if body.link else "select_account"
    set_ticket(response, FLOW, "flow", flow, apple=body.provider == "apple")
    return {"url": PROVIDERS[body.provider][0] + "?" + urlencode(query)}


def external(method, url, **kwargs):
    try:
        with httpx.Client(timeout=10) as client:
            result = client.request(method, url, **kwargs)
        if not result.is_success:
            raise HTTPException(401, "인증을 마치지 못했어요. 로그인부터 다시 시도해 주세요.")
        return result.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "인증 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.") from None


@lru_cache(maxsize=1)
def apple_keys(bucket):
    return external("GET", "https://appleid.apple.com/auth/keys")["keys"]


def exchange(provider, code, flow, request):
    prefix = provider.upper()
    data = {"grant_type": "authorization_code", "code": code, "client_id": os.environ[prefix + "_CLIENT_ID"], "client_secret": os.environ[prefix + "_CLIENT_SECRET"], "redirect_uri": app_origin(request) + "/api/auth/callback/" + provider}
    if provider == "google":
        data["code_verifier"] = flow["verifier"]
    tokens = external("POST", PROVIDERS[provider][1], data=data)
    if provider == "apple":
        try:
            encoded = tokens["id_token"]
            header = jwt.get_unverified_header(encoded)
            key = next(k for k in apple_keys(int(time.time() // 300)) if k["kid"] == header.get("kid"))
            claims = jwt.decode(encoded, jwt.PyJWK.from_dict(key).key, algorithms=["RS256"], audience=data["client_id"], issuer="https://appleid.apple.com", options={"require": ["exp", "iat", "sub", "aud", "iss", "nonce"]})
            if not hmac.compare_digest(claims["nonce"], flow["nonce"]):
                raise ValueError()
            email = claims.get("email") if claims.get("email_verified") in (True, "true") else None
            subject = claims["sub"]
        except (jwt.PyJWTError, KeyError, TypeError, ValueError, StopIteration):
            raise HTTPException(401, "Apple 인증을 확인하지 못했어요. 다시 로그인해 주세요.") from None
    else:
        token = tokens.get("access_token")
        if not isinstance(token, str) or not token or len(token) > 8192:
            raise HTTPException(401, "인증을 확인하지 못했어요.")
        url = "https://openidconnect.googleapis.com/v1/userinfo" if provider == "google" else "https://kapi.kakao.com/v2/user/me"
        info = external("GET", url, headers={"Authorization": "Bearer " + token})
        if provider == "google":
            subject = info.get("sub")
            email = info.get("email") if info.get("email_verified") is True else None
        else:
            subject = str(info["id"]) if type(info.get("id")) is int else None
            account = info.get("kakao_account", {})
            email = account.get("email") if account.get("is_email_verified") is True and account.get("is_email_valid") is True else None
    if not isinstance(subject, str) or not 1 <= len(subject) <= 255:
        raise HTTPException(401, "인증한 계정을 확인하지 못했어요.")
    if email is not None:
        if not isinstance(email, str) or len(email) > 320 or "@" not in email:
            raise HTTPException(401, "이메일 정보를 확인하지 못했어요.")
        email = email.strip().lower()
    return {"provider": provider, "subject": subject, "email": email}


def finish_identity(identity, flow, request, store):
    user = identity_for(store, identity)
    response = RedirectResponse("/?auth=success&view=" + flow["return_to"], status_code=303)
    if flow.get("link_user"):
        pending = unseal(request.cookies.get(PENDING), "signup")
        if not user or user["id"] != flow["link_user"] or pending["nonce"] != flow["link_pending"]:
            raise HTTPException(403, "연결할 기존 계정으로 다시 로그인해 주세요.")
        rpc(store, "link_login_identity", {"p_user_id": user["id"], "p_provider": pending["identity"]["provider"], "p_subject": pending["identity"]["subject"], "p_email": pending["identity"]["email"], "p_proof_hash": accounts.hash_token(pending["nonce"])})
    elif not user:
        nonce = secrets.token_urlsafe(32)
        store.call("POST", "auth_challenges", body={"token_hash": accounts.hash_token(nonce), "purpose": "signup", "expires_at": accounts.utc_text(datetime.fromtimestamp(time.time() + TTL, timezone.utc))}, prefer="return=minimal")
        set_ticket(response, PENDING, "signup", {"identity": identity, "nonce": nonce, "return_to": flow["return_to"]})
        response.headers["location"] = "/?auth=signup&view=" + flow["return_to"]
        return response
    clear_ticket(response, PENDING)
    accounts.create_session(store, response, user["id"])
    return response


def finish_oauth(provider, values, request, store):
    response = RedirectResponse("/?auth=error&view=my", status_code=303)
    try:
        flow = unseal(request.cookies.get(FLOW), "flow")
        if provider not in PROVIDERS or flow["provider"] != provider or not hmac.compare_digest(values.get("state", ""), flow["state"]):
            raise HTTPException(401, "인증 요청이 일치하지 않아요.")
        if values.get("error"):
            response.headers["location"] = "/?auth=cancelled&view=" + flow["return_to"]
        else:
            code = values.get("code", "")
            if not code or len(code) > 4096:
                raise HTTPException(400, "인증 코드가 없어요.")
            response = finish_identity(exchange(provider, code, flow, request), flow, request, store)
    except (HTTPException, KeyError):
        pass
    clear_ticket(response, FLOW)
    return response


@router.get("/callback/{provider}")
def oauth_callback(provider: str, request: Request, store=Depends(accounts.account_store)):
    if provider == "apple":
        raise HTTPException(405, "지원하지 않는 인증 응답이에요.")
    return finish_oauth(provider, dict(request.query_params), request, store)


@router.post("/callback/apple")
async def apple_callback(request: Request, store=Depends(accounts.account_store)):
    if request.headers.get("content-type", "").split(";")[0] != "application/x-www-form-urlencoded":
        raise HTTPException(415, "지원하지 않는 인증 응답이에요.")
    values = {k: v[0] for k, v in parse_qs((await request.body()).decode("utf-8", errors="replace")).items() if len(v) == 1}
    return await run_in_threadpool(finish_oauth, "apple", values, request, store)


class EmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    return_to: str = "my"
    link: bool = False


def send_email(address, url):
    message = EmailMessage()
    message["From"] = os.environ["SMTP_FROM"]
    message["To"] = address
    message["Subject"] = "캠퍼스하이 로그인 링크"
    message.set_content("캠퍼스하이 로그인을 요청하셨나요?\n\n아래 링크를 요청한 브라우저에서 10분 안에 열어 주세요. 한 번만 사용할 수 있어요.\n\n" + url + "\n\n요청하지 않았다면 이 메일을 무시해 주세요.")
    try:
        port = int(os.getenv("SMTP_PORT", "587"))
        with smtplib.SMTP(os.environ["SMTP_HOST"], port, timeout=10) as server:
            server.starttls(context=ssl.create_default_context())
            server.login(os.environ["SMTP_USERNAME"], os.environ["SMTP_PASSWORD"])
            server.send_message(message)
    except (OSError, ValueError, smtplib.SMTPException):
        raise HTTPException(503, "로그인 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.") from None


@router.post("/email")
def email_start(body: EmailRequest, request: Request, response: Response, store=Depends(accounts.account_store)):
    same_origin(request)
    if not enabled_providers(request)[1]:
        raise HTTPException(503, "이메일 로그인을 준비하고 있어요.")
    address = body.email.lower()
    flow = flow_context(request, LoginRequest(provider="email", return_to=body.return_to, link=body.link), store)
    token = secrets.token_urlsafe(32)
    digest = accounts.hash_token(token)
    accepted = rpc(store, "begin_email_login", {"p_hash": digest, "p_mailbox_hash": hmac.new(signing_key(), address.encode(), "sha256").hexdigest()})
    if not accepted:
        raise HTTPException(429, "메일 요청이 많아요. 잠시 후 다시 시도해 주세요.")
    try:
        send_email(address, app_origin(request) + "/api/auth/email/callback?token=" + token)
    except HTTPException:
        rpc(store, "consume_auth_challenge", {"p_hash": digest, "p_purpose": "email"})
        raise
    set_ticket(response, FLOW, "flow", {**flow, "email": address, "email_hash": digest})
    return {"sent": True}


@router.get("/email/callback")
def email_callback(request: Request, store=Depends(accounts.account_store)):
    response = RedirectResponse("/?auth=error&view=my", status_code=303)
    try:
        flow = unseal(request.cookies.get(FLOW), "flow")
        token = request.query_params.get("token", "")
        if flow["provider"] != "email" or not accounts.TOKEN_PATTERN.fullmatch(token) or not hmac.compare_digest(flow["email_hash"], accounts.hash_token(token)):
            raise HTTPException(401, "로그인 메일을 요청한 브라우저에서 열어 주세요.")
        if not rpc(store, "consume_auth_challenge", {"p_hash": flow["email_hash"], "p_purpose": "email"}):
            raise HTTPException(401, "링크를 다시 요청해 주세요.")
        response = finish_identity({"provider": "email", "subject": flow["email"], "email": flow["email"]}, flow, request, store)
    except (HTTPException, KeyError):
        pass
    clear_ticket(response, FLOW)
    return response


@router.get("/pending")
def pending_signup(request: Request, store=Depends(accounts.account_store)):
    try:
        pending = unseal(request.cookies.get(PENDING), "signup")
    except HTTPException as error:
        if error.status_code != 401:
            raise
        return {"pending": False}
    target = matching_account(store, pending["identity"])
    try:
        from backend.signup import REGISTRATION, registration_policy
        preflight = unseal(request.cookies.get(REGISTRATION), "registration")
        if preflight["policy_version"] != registration_policy()["version"]:
            preflight = None
    except HTTPException:
        preflight = None
    return {"pending": True, "link_provider": target["provider"] if target else None, "preflight": {k: preflight[k] for k in ("birth_year", "role", "terms_agreed", "privacy_agreed", "marketing_agreed")} if preflight else None}


@router.post("/logout")
def logout(request: Request, response: Response, store=Depends(accounts.account_store)):
    same_origin(request)
    accounts.end_session(store, request, response)
    clear_ticket(response, FLOW)
    clear_ticket(response, PENDING)
    return {"ok": True}


def discard_pending(request, response, store=None):
    for name, kind, field, purpose in ((PENDING, "signup", "nonce", "signup"), (FLOW, "flow", "email_hash", "email")):
        if request.cookies.get(name):
            try:
                ticket = unseal(request.cookies[name], kind)
                if field in ticket:
                    digest = accounts.hash_token(ticket[field]) if field == "nonce" else ticket[field]
                    rpc(store or accounts.account_store(), "consume_auth_challenge", {"p_hash": digest, "p_purpose": purpose})
            except HTTPException as error:
                if error.status_code != 401:
                    raise
        clear_ticket(response, name)


@router.post("/cancel")
def cancel(request: Request, store=Depends(accounts.account_store)):
    same_origin(request)
    response = JSONResponse({"ok": True})
    discard_pending(request, response, store)
    from backend.signup import REGISTRATION
    clear_ticket(response, REGISTRATION)
    return response
