"""계정·로그인 세션(이슈 #30).

사용자와 세션은 Supabase의 Postgres에 두고(supabase/migrations/20261118120000_account_base.sql), 이 서버만 서버 키로
Supabase REST(PostgREST)를 불러 읽고 쓴다. 브라우저는 Supabase를 직접 부르지 않고 우리 /api만 부른다.
세션은 HttpOnly·Secure·SameSite 쿠키에 무작위 토큰만 두고, DB에는 그 토큰의 SHA-256 해시만 둔다.
"""

import hashlib
import logging
import os
import re
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException

logger = logging.getLogger("uvicorn.error")

# __Host- 접두어: 브라우저가 Secure·Path=/·Domain 없음일 때만 받아 주므로, 다른 하위 도메인(*.vercel.app 등)이 이 쿠키를 덮어쓸 수 없다.
SESSION_COOKIE = "__Host-campushi_session"
# 로그인 유지 기간(일). 팀 회의 안건이라 아직 정하지 않았다(docs/PLAN.md). 정해질 때까지 쓰는 임시 기본값이고 SESSION_MAX_AGE_DAYS로 바꾼다.
DEFAULT_SESSION_DAYS = 30
MAX_SESSION_DAYS = 365
TOKEN_BYTES = 32
TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")
TIMEOUT_SECONDS = 5
# /api/me로 돌려줘도 되는 필드. id·provider_user_id 같은 내부 값과 세션 정보는 내보내지 않는다.
PUBLIC_FIELDS = ("provider", "email", "role", "birth_year", "terms_agreed_at", "created_at")

NOT_LOGGED_IN = "로그인이 필요해요."
SESSION_ENDED = "로그인이 만료되었어요. 다시 로그인해 주세요."
NOT_CONFIGURED = "서버에 계정 저장소 설정이 없어 로그인 기능을 쓸 수 없어요."
UNREACHABLE = "계정 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요."
MISCONFIGURED = "계정 서버 설정에 문제가 있어요. 잠시 후 다시 시도해 주세요."
BAD_REPLY = "계정 서버의 응답을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."


class AccountError(HTTPException):
    """사용자에게 보여 줄 한국어 메시지와 상태 코드. 쓸 수 없는 세션 쿠키면 응답에서 쿠키를 지운다."""

    def __init__(self, status_code, detail, clear_cookie=False):
        super().__init__(status_code=status_code, detail=detail)
        self.clear_cookie = clear_cookie


@dataclass
class SupabaseRest:
    """Supabase REST(PostgREST)를 서버 키로 부른다. 키는 apikey 헤더로만 보낸다(Supabase의 새 secret key 방식)."""

    url: str
    key: str = field(repr=False)
    transport: httpx.BaseTransport | None = field(default=None, repr=False)

    def call(self, method, table, params=None, body=None, prefer=None):
        headers = {"apikey": self.key, "Accept": "application/json"}
        if prefer:
            headers["Prefer"] = prefer
        try:
            with httpx.Client(base_url=f"{self.url}/rest/v1", transport=self.transport, timeout=TIMEOUT_SECONDS) as client:
                response = client.request(method, f"/{table}", params=params, json=body, headers=headers)
        except httpx.HTTPError as error:
            # 연결 실패·시간 초과. 무료 플랜이 일시정지됐거나 Supabase에 장애가 있을 때도 여기로 온다.
            logger.error("Supabase에 연결하지 못했습니다: %s %s", method, table, exc_info=error)
            raise AccountError(503, UNREACHABLE) from None
        if response.status_code >= 500:
            # 5xx와 Supabase의 540(일시정지된 프로젝트 등)
            logger.error("Supabase가 %s 응답을 보냈습니다: %s %s", response.status_code, method, table)
            raise AccountError(503, UNREACHABLE)
        if response.status_code in (401, 403):
            logger.error("Supabase가 서버 키를 받지 않았습니다(%s). SUPABASE_SECRET_KEY와 테이블 권한을 확인하세요.", response.status_code)
            raise AccountError(500, MISCONFIGURED)
        if response.status_code >= 400:
            logger.error("Supabase가 %s 응답을 보냈습니다: %s %s", response.status_code, method, table)
            raise AccountError(502, BAD_REPLY)
        return response


def store_from_env(transport=None):
    """환경변수(VITE_SUPABASE_URL, SUPABASE_SECRET_KEY)로 Supabase REST를 만든다. 없거나 주소가 틀리면 503."""
    url = os.environ.get("VITE_SUPABASE_URL", "").strip().rstrip("/")
    key = os.environ.get("SUPABASE_SECRET_KEY", "").strip()
    local = url.startswith(("http://127.0.0.1:", "http://localhost:"))
    if not key or not (url.startswith("https://") or local):
        logger.error("계정 기능에 필요한 환경변수 VITE_SUPABASE_URL(https 주소)와 SUPABASE_SECRET_KEY가 없습니다.")
        raise AccountError(503, NOT_CONFIGURED)
    return SupabaseRest(url, key, transport)


def account_store():
    """FastAPI 의존성. 테스트는 이것을 가짜 HTTP 응답을 쓰는 저장소로 바꾼다."""
    return store_from_env()


def session_days():
    """로그인 유지 기간(일). SESSION_MAX_AGE_DAYS가 1~365의 정수가 아니면 임시 기본값을 쓴다."""
    raw = os.environ.get("SESSION_MAX_AGE_DAYS", "").strip()
    if raw.isdigit() and 1 <= int(raw) <= MAX_SESSION_DAYS:
        return int(raw)
    if raw:
        logger.warning("SESSION_MAX_AGE_DAYS(%r)가 1~%d의 정수가 아니어서 %d일을 씁니다.", raw, MAX_SESSION_DAYS, DEFAULT_SESSION_DAYS)
    return DEFAULT_SESSION_DAYS


def hash_token(token):
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def utc_text(moment):
    return moment.astimezone(timezone.utc).isoformat()


def cookie_options():
    # Lax: 카카오·구글 로그인처럼 다른 사이트에서 돌아오는 최상위 이동(GET)에는 쿠키가 실려 로그인 상태가 유지되고,
    # 다른 사이트가 보내는 POST·fetch·iframe 요청에는 실리지 않는다. Strict면 로그인 직후 리다이렉트와 외부 링크로 들어온 첫 화면이 로그아웃처럼 보인다.
    # Secure는 늘 켠다. 로컬 개발 주소 http://127.0.0.1·localhost는 크롬·파이어폭스가 안전한 출처로 보아 Secure 쿠키를 받는다.
    return {"httponly": True, "secure": True, "samesite": "lax", "path": "/"}


def create_session(store, response, user_id, now=None):
    """로그인 세션을 만들고 응답에 쿠키를 싣는다. 쿠키에 들어간 무작위 토큰을 돌려준다(DB에는 해시만 남는다)."""
    now = now or datetime.now(timezone.utc)
    days = session_days()
    token = secrets.token_urlsafe(TOKEN_BYTES)
    store.call(
        "POST",
        "sessions",
        body={"token_hash": hash_token(token), "user_id": user_id, "expires_at": utc_text(now + timedelta(days=days)), "created_at": utc_text(now)},
        prefer="return=minimal",
    )
    response.set_cookie(SESSION_COOKIE, token, max_age=days * 24 * 60 * 60, **cookie_options())
    return token


def clear_session_cookie(response):
    response.delete_cookie(SESSION_COOKIE, **cookie_options())


def current_user(store, request, now=None):
    """쿠키의 세션으로 지금 로그인한 사용자의 공개 필드를 찾는다. 로그인하지 않았거나 만료·위조된 세션이면 401."""
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise AccountError(401, NOT_LOGGED_IN)
    # 형식이 틀린 토큰은 DB에 묻지 않는다.
    if not TOKEN_PATTERN.match(token):
        raise AccountError(401, SESSION_ENDED, clear_cookie=True)
    now = now or datetime.now(timezone.utc)
    response = store.call(
        "GET",
        "sessions",
        params={
            "select": f"user:users({','.join(PUBLIC_FIELDS)})",
            "token_hash": f"eq.{hash_token(token)}",
            "expires_at": f"gt.{utc_text(now)}",
            "limit": "1",
        },
    )
    try:
        rows = response.json()
        if not isinstance(rows, list):
            raise ValueError("목록이 아님")
        if not rows:
            raise AccountError(401, SESSION_ENDED, clear_cookie=True)
        user = rows[0]["user"]
        return {key: user[key] for key in PUBLIC_FIELDS}
    except AccountError:
        raise
    except (ValueError, KeyError, TypeError, IndexError) as error:
        logger.error("Supabase 세션 응답 형식이 예상과 다릅니다.", exc_info=error)
        raise AccountError(502, BAD_REPLY) from None


def end_session(store, request, response):
    """로그아웃: 이 쿠키의 세션을 DB에서 지우고 쿠키도 지운다. 쿠키가 없거나 형식이 틀려도 쿠키는 지운다."""
    token = request.cookies.get(SESSION_COOKIE)
    if token and TOKEN_PATTERN.match(token):
        store.call("DELETE", "sessions", params={"token_hash": f"eq.{hash_token(token)}"}, prefer="return=minimal")
    clear_session_cookie(response)
