# 캠퍼스하이 (최소 MVP)

경희대학교 **컴퓨터공학과**와 **산업디자인학과**에 체험 입학해, 학교 공식 교육과정의 과목을 학년별로 들으며 미리 경험해 보는 웹 서비스입니다. 학생이 직접 쓰는 B2C 서비스이고, 학교와의 제휴 표시는 두지 않습니다(2026-11-09).

- 시작하기 → 학교 고르기(경희대 국제캠퍼스, 서울캠퍼스는 준비 중) → 국제캠퍼스 지도(처음엔 캐릭터가 지도 아래로 떨어져 안내): 학과가 있는 건물(전자정보/응용과학대학관, 예술·디자인대학관)을 눌러 학과에 체험 입학합니다.
- 입학하면 열린 학년의 과목을 아무 순서로나 듣고 성적(A+~F, 작품은 P)을 받습니다. 그 학년 필수과목(전공기초·전공필수) 중 체험이 있는 것을 모두 B- 이상 받으면 다음 학년이 열리고, C+ 이하는 재수강합니다(가장 좋은 성적이 남음).
- 4학년 필수과목과 졸업 과제(컴공: AI 가르치기, 산디: 도색 졸업작품)를 이수하면 졸업합니다. 체험이 아직 없는 과목은 "구현 예정"으로 표시되고 해금 조건에서 빠집니다.
- 과목을 이수할 때마다 크레딧을 받습니다(멘토링에 쓸 예정).
- 기록은 이 브라우저에만 저장됩니다(계정 없음).

## 실행

Node.js 22.12 이상과 Python 3.10 이상이 필요합니다.

```bash
npm start
```

처음 실행하면 프런트 패키지와 백엔드 가상환경(`backend/.venv`)을 준비한 뒤 백엔드(8000)와 프런트(5173)를 함께 띄웁니다.

## 테스트와 빌드

```bash
npm test
```

```bash
backend/.venv/bin/python -m pip install -r backend/requirements-test.txt
```

```bash
backend/.venv/bin/python -m unittest backend.test_api
```

```bash
npm run build
```

## 구조

| 위치 | 내용 |
| --- | --- |
| `frontend/` | React 19 + Vite + Tailwind CSS v4 화면 |
| `backend/main.py` | FastAPI: `/api/health`, `/api/departments`, `/api/lesson_game` |
| `backend/data/departments.json` | 두 학과의 공식 편성표 (출처: `backend/SOURCE.md`) |
| `backend/data/theory_banks.jsonl` | 이론 수업 문제 은행 (체험할 때마다 3라운드를 새로 뽑음) |
| `api/index.py`, `vercel.json` | Vercel 배포 설정(정적 프런트 + 서버리스 API) |

작업 규칙은 `CLAUDE.md`에 있습니다.
