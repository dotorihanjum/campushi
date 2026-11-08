import json
import logging
import re
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger("uvicorn.error")
DATA_DIR = Path(__file__).parent / "data"
DEPARTMENTS_PATH = DATA_DIR / "departments.json"
GAMES_PATH = DATA_DIR / "lesson_games.jsonl"
THEORY_PATH = DATA_DIR / "theory_banks.jsonl"
DIST_PATH = Path(__file__).parent.parent / "frontend" / "dist"
MAX_BODY_BYTES = 16 * 1024
YEARS = ("1", "2", "3", "4")
HASHED_ASSET = re.compile(r"^/assets/.+-[A-Za-z0-9_-]{8}\.(js|css|png|webp|svg)$")
CONTENT_SECURITY_POLICY = "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    # 글꼴(Pretendard)을 jsDelivr에서 불러온다.
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "font-src 'self' https://cdn.jsdelivr.net",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])


@asynccontextmanager
async def lifespan(app):
    logger.info("학과 %d곳, 연습 문제 %d건을 불러왔습니다.", len(departments()), len(lesson_games()))
    yield


app = FastAPI(title="Campushi API", version="1.0.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1024)


class GameRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    subject: str = Field(min_length=1, max_length=200)


@app.middleware("http")
async def guard(request, call_next):
    if request.method in ("POST", "PUT", "PATCH"):
        length = request.headers.get("content-length", "")
        if not length.isdigit():
            return JSONResponse(status_code=411, content={"detail": "요청 본문의 길이를 확인할 수 없습니다."})
        if int(length) > MAX_BODY_BYTES:
            return JSONResponse(status_code=413, content={"detail": "요청이 너무 큽니다."})
    response = await call_next(request)
    path = request.url.path
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    elif HASHED_ASSET.match(path):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif path not in ("/docs", "/redoc", "/openapi.json"):
        response.headers["Cache-Control"] = "no-cache"
        response.headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    field = exc.errors()[0]["loc"][-1] if exc.errors() else ""
    message = "과목을 작성해주세요." if field == "subject" else "필수 항목을 올바르게 작성해주세요."
    return JSONResponse(status_code=400, content={"detail": message})


@app.exception_handler(Exception)
async def server_error(request, exc):
    logger.error("%s %s 처리 중 오류", request.method, request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요."})


def check_department(item):
    """학과 데이터가 화면이 기대하는 모양인지 확인한다. 학년마다 1·2학기에 하나씩 고를 수 있게 과목이 둘 이상 있어야 하고,
    실습·졸업 과제 과목은 공식 편성표의 과목이어야 한다."""
    name = f"{item.get('id')}"
    years = item.get("years", {})
    if set(years) != set(YEARS):
        raise ValueError(f"{name}: 1~4학년 편성이 모두 있어야 합니다.")
    for year in YEARS:
        if len(set(years[year])) != len(years[year]):
            raise ValueError(f"{name}: {year}학년에 같은 과목이 두 번 있습니다.")
    if item.get("final") not in years["4"]:
        raise ValueError(f"{name}: 졸업 과제는 4학년 편성표의 과목이어야 합니다.")
    for year in YEARS:
        if len([subject for subject in years[year] if subject != item["final"]]) < 2:
            raise ValueError(f"{name}: {year}학년에 고를 과목이 둘 이상 있어야 합니다(1·2학기에 하나씩 고름).")
    if item.get("practice") and not any(item["practice"] in years[year] for year in YEARS):
        raise ValueError(f"{name}: 실습 과목은 편성표의 과목이어야 합니다.")
    if not str(item.get("source", {}).get("url", "")).startswith("https://"):
        raise ValueError(f"{name}: 교육과정 출처 주소가 필요합니다.")


@lru_cache(maxsize=1)
def departments():
    """학과 데이터(`data/departments.json`). 형식이 틀리면 서버를 띄우지 않는다."""
    items = json.loads(DEPARTMENTS_PATH.read_text(encoding="utf-8"))["departments"]
    for item in items:
        check_department(item)
    return items


def verified_lines(path, subjects):
    """jsonl에서 검증을 통과했고(status: verified) 편성표 과목인 것만 과목 → 내용으로. 검증 기록(check)은 내보내지 않는다."""
    found = {}
    if path.exists():
        with path.open(encoding="utf-8") as file:
            for line in file:
                item = json.loads(line) if line.strip() else {}
                if item.get("status") == "verified" and item.get("course_name") in subjects:
                    found[item["course_name"]] = {key: value for key, value in item.items() if key != "check"}
    return found


@lru_cache(maxsize=1)
def lesson_games():
    """검증을 통과한 연습 문제: 과목 → 문제. 두 학과 편성표의 과목 것만 둔다.
    이론 수업 문제 은행(theory_banks.jsonl, 유형 theory)이 있는 과목은 고정된 문제 대신 은행을 쓴다."""
    subjects = {subject for item in departments() for year in YEARS for subject in item["years"][year]}
    games = verified_lines(GAMES_PATH, subjects)
    for subject, bank in verified_lines(THEORY_PATH, subjects).items():
        games[subject] = {**bank, "type": "theory"}
    return games


@app.get("/api/health")
def health():
    return {"status": "ok", "departments": len(departments()), "lesson_games": len(lesson_games())}


@app.get("/api/departments")
def department_list():
    games = lesson_games()
    return {
        "departments": [
            {**item, "games": {subject: games[subject]["type"] for year in YEARS for subject in item["years"][year] if subject in games}}
            for item in departments()
        ]
    }


@app.post("/api/lesson_game")
def lesson_game(body: GameRequest):
    game = lesson_games().get(body.subject)
    if not game:
        raise HTTPException(status_code=404, detail="이 과목의 연습 문제가 아직 없어요.")
    return {"game": game}


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
def unknown_api(path: str):
    raise HTTPException(status_code=404, detail="요청한 주소를 찾을 수 없습니다.")


# 빌드된 프런트엔드가 있으면 같은 서버에서 함께 제공한다(운영 배포용).
if DIST_PATH.is_dir():
    app.mount("/", StaticFiles(directory=DIST_PATH, html=True), name="frontend")
