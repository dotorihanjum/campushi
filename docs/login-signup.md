# 로그인·가입 보호 (#31 → #32)

2026-11-20 구현. 최신 main `43b78b3`의 #30 계정 서버를 기준으로 한다. 예전 `feat/supabase-account-sync` 미커밋 Supabase Auth 초안은 `git stash`에 `backup: Supabase Auth draft before aligning with main issue 30`이라는 이름으로 보존했고, 활성 코드에는 적용하지 않았다.

## 구조와 범위

- `backend/accounts.py`의 `public.users`, `public.sessions`, `/api/me`, 무작위 세션 토큰·DB 해시·HttpOnly/Secure/SameSite 쿠키를 재사용한다. Supabase Auth 계정이나 별도의 계정 상태 테이블을 만들지 않는다.
- 이메일 링크는 SMTP, 구글·카카오·애플은 제공자 OAuth로 직접 인증한다. 따라서 Supabase Auth의 Redirect URLs 목록은 이번 구조에 사용하지 않는다. 소셜 콜백은 각 제공자의 개발자 콘솔에 등록한다.
- 인증된 신원은 10분 동안 서명된 HttpOnly 쿠키에만 임시 보관한다. DB에는 일회용 증명의 무작위 해시만 저장한다. 새 계정은 나이·필수 동의를 통과한 뒤에만 생성한다.
- 같은 이메일만으로 계정을 합치지 않는다. 기존 계정의 기본 로그인 수단으로 새 인증을 완료한 뒤에만 로그인 수단을 연결한다. 연결은 계정의 기존 이메일과 검증된 이메일이 같은지 다시 확인한다.
- 서버가 검증하지 않은 이메일은 연결 근거로 사용하지 않는다. 카카오 이메일은 선택 사항이며, 없는 경우 별도 제공자 신원으로 가입한다.
- 로그인·가입 모달은 마이페이지 스크롤 내용이 아닌 Screen.overlay에 포털로 배치한다. 긴 내용의 내부 스크롤과 탭바 차단을 유지한다.
- 이번 작업은 로그인과 가입 보호다. 프로필·체험 기록은 기존 브라우저 저장을 유지하며, 입학일·저장소 차단 대응·성적·크레딧 규칙을 변경하지 않는다. #33 기록 이전, #34 동기화, #35 전체 로그아웃 수용 기준, #36 탈퇴는 후속 작업이다. 제공한 로그아웃은 기존 세션 종료 기능이며 기록 이전/미전송 큐 기능을 구현했다는 뜻이 아니다.

## 이슈별 브랜치

- `fe/31-login`: 기존 계정의 이메일·소셜 인증, 로그인 진입·취소·복귀, 연결 시 기존 계정 재인증, 필요한 서버 전용 DB 기반.
- `fe/32-signup-protection`: #31 위에 쌓은 브랜치. 가입 화면·역할·출생연도·필수/선택 동의·가입 제한, 가입 함수와 확인용 SQL. #31 병합 후 최신 main에 맞춰 올린다.

운영 main에는 직접 푸시하지 않는다. 로그인·저장 구조·의존성 변경이므로 PR 검토와 원준 승인이 필요하다. 작업량이 400줄을 넘으며 테스트만으로 정책 검토를 대신하지 않는다.

## 환경 설정

`frontend/.env.example`을 `frontend/.env.local`로 복사하고 실제 값을 넣는다. `npm start`는 이 파일을 FastAPI와 Vite 양쪽에 전달하며 셸 환경변수가 우선한다. 직접 uvicorn을 실행할 때는 별도로 환경변수를 전달한다. 서버 비밀값의 이름에 `VITE_`를 붙이지 않는다.

필수 기반: 기존 `VITE_SUPABASE_URL`, `SUPABASE_SECRET_KEY`. 임시 인증 쿠키용 `AUTH_COOKIE_SECRET`을 별도로 두는 것을 권장한다. `VITE_SUPABASE_PUBLISHABLE_KEY`는 기존 환경에 있어도 괜찮지만 이번 서버 전용 구조에서는 사용하지 않는다.

| 방식 | 필요한 설정 | 제공자에 등록할 복귀 경로 |
| --- | --- | --- |
| 이메일 | `SMTP_HOST/PORT/FROM/USERNAME/PASSWORD`, STARTTLS | 메일 링크는 앱의 `/api/auth/email/callback`으로 생성 |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `/api/auth/callback/google` |
| Kakao | `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` | `/api/auth/callback/kakao` |
| Apple | `APPLE_CLIENT_ID`, 유효한 `APPLE_CLIENT_SECRET` JWT | HTTPS `/api/auth/callback/apple` |

운영·팀 프리뷰는 `AUTH_BASE_URL`에 **그 배포의 정확한 HTTPS origin**을 설정한다. 프리뷰를 운영 origin으로 설정하면 Origin 검사에서 거부된다. 로컬은 비워 두면 loopback 주소를 사용한다. Vite 개발·preview 프록시는 원래 Host를 유지한다. Apple은 HTTPS 환경에서만 제공한다.

비밀값이 설정된 로그인 방식만 화면에 표시한다. 실제 제공자 앱 키·SMTP 설정은 이번 작업에서 생성하거나 변경하지 않았다. 기존 CSP의 `connect-src 'self'`를 유지한다. 브라우저는 우리 `/api`만 호출하고, OAuth 외부 통신·Supabase 통신은 서버가 처리하므로 불필요하게 외부 연결을 허용하지 않는다.

마이그레이션 순서:

1. 기존 `20261118120000_account_base.sql`
2. #31 `20261120000100_login.sql`
3. #32 `20261120000200_signup.sql`

GitHub 통합의 main 배포로 적용하고, 대시보드에서 따로 SQL을 실행하지 않는다. 이 작업에서 운영 DB에는 적용하지 않았다.

## 임시 약관 URL 교체

사용자가 2026-11-20에 **임시 URL로 기능 개발을 계속하고, 문서가 없다는 이유로 가입을 막지 말 것**을 요청했다.

- 기본 URL은 `https://example.com/terms`, `https://example.com/privacy`다. 기본값은 `backend/signup.py` 한 곳에 있다.
- 환경변수 `AUTH_TERMS_URL`, `AUTH_PRIVACY_URL`, `AUTH_TERMS_VERSION`으로 코드 변경 없이 함께 교체할 수 있다.
- 임시 버전 `development-placeholder-v1`과 동의 시각을 기록하며, 화면에 개발용 임시 링크라는 안내를 표시한다. 이 동의를 승인된 실제 약관에 대한 동의라고 간주하지 않는다.
- 선택 이메일 수신은 기본 미동의다. `AUTH_MARKETING_LABEL`로 문구를 교체할 수 있고, 선택하지 않아도 가입한다.
- URL은 HTTPS만 허용한다. `javascript:` 등 실행 가능한 주소는 설정 단계에서 거부한다.

## 가입 보호와 보안

- 나이는 한국 시간의 가입 연도를 기준으로 계산한다. `가입 연도 − 출생연도 >= 15`만 허용한다. 2026년에는 2012년생을 거부하고 2011년생을 허용한다. 이는 프로젝트에서 정한 보수적 판정이며 실명·생년월일 본인인증이 아니다.
- 나이 제한 시 임시 인증 증명을 소비하고 쿠키를 정리한다. 서버의 사용자·세션에 소셜 정보·출생연도를 생성하지 않는다. 같은 창에서는 sessionStorage와 메모리로 재시도를 막고, 브라우저 저장소를 쓸 수 없어도 현재 방문 중 표시를 유지한다.
- 필수 동의 두 개와 정책 버전을 서버가 확인한다. `admin` 역할, 문자열 연도·문자열 동의값, 사용자 ID 주입은 거부한다. 멘토 지원은 `mentor_status=pending`이며 인증 완료 멘토가 아니다.
- 사용자·로그인 수단 생성은 하나의 DB 함수/트랜잭션에서 처리한다. 재전송으로 계정이 여러 개 생기지 않는다. 응답 유실로 가입 상태가 불명확하면 다시 인증해 기존 계정으로 로그인한다.
- DB의 브라우저 역할에는 사용자·세션·인증 해시·메일 제한 테이블 권한이 없다. 서버도 사용자 직접 INSERT 권한을 받지 않고 제한된 가입 함수를 호출한다.
- Google은 state+PKCE, Kakao는 state, Apple은 state+nonce와 ID token의 RSA 서명·issuer·audience·만료를 확인한다. Apple form_post용 임시 쿠키만 SameSite=None이며 기본 세션은 기존 Lax다.
- 이메일 링크는 한 번만, 요청한 브라우저에서만 쓴다. 인증 링크를 새로 요청하면 이전 브라우저 흐름은 무효가 된다. 메일 요청은 주소별 1분 간격·시간당 5회, 앱 전체 시간당 100회 제한이다. DB에는 수신 주소 대신 키로 해시한 제한용 값만 둔다.
- 변경 API는 JSON Content-Type과 정확한 Origin을 검사한다. 인증 API는 no-store/no-referrer로 응답한다. 인증 취소도 임시 증명을 정리한다. 로그인 요청·서버 응답 본문을 로그에 출력하지 않는다.
- 로컬 쿠키는 포트로 격리되지 않는다. 개발 중에는 신뢰하는 서버·전용 브라우저 프로필·테스트 계정을 사용한다.

## 검증과 한계

```bash
npm test
npm run build
backend/.venv/bin/python -m unittest backend.test_api
```

로컬 PostgreSQL에는 `supabase/checks/supabase_roles.sql` → 위 마이그레이션 3개 → `supabase/checks/account_base.sql` → `supabase/checks/login_signup.sql` 순서로 적용해 검사한다. 기존 계정 기반 검사도 함께 통과해야 한다. 검사용 SQL은 운영 DB에서 실행하지 않는다.

2026-11-20 확인:

- 프론트 테스트 132개, 백엔드 테스트 42개 및 빌드 통과(후속 검증 결과가 있으면 함께 확인).
- 실제 PostgreSQL 엔진(PGlite)에서 기존/신규 마이그레이션, 역할별 차단, 나이 경계, 일회용 링크, 멘토 지원 상태, 중복 가입 검사 통과.
- 외부로 보내지 않는 로컬 TLS SMTP 서버 + 실제 앱 코드 + 로컬 PostgreSQL을 연결해 Chrome에서 이메일 요청 → 링크 → 가입 → 새로고침 → 로그아웃 → 재로그인을 직접 확인했다. 가입 전 2012년생 거부 후 사용자/세션 0개, 정상 가입 후 1/1개, 로그아웃 후 1/0개, 재로그인 후 계정 추가 없이 1/1개였다. 프로필 이름도 유지됐다.
- 소셜 인증은 제공자 응답을 테스트 대역으로 검사했고, Apple은 로컬 RSA 키로 실제 서명 검증도 검사했다. 실제 Google/Kakao/Apple 앱 키로 로그인하는 검증과 운영 SMTP 발송은 아직 하지 않았다.
- 운영 Supabase 마이그레이션·Vercel 환경변수·제공자 설정은 별도 운영 반영 단계다. 기능 코드를 검증했다고 운영 설정까지 완료된 것으로 보고하지 않는다.
- 승인된 약관 문서는 아직 없으며 사용자가 지정한 임시 URL 상태다. 실제 서비스 공개 시 정식 문서·동의 버전으로 교체해야 한다.
