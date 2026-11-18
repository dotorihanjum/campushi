-- 계정 서버 기반(이슈 #30): 사용자(users)와 로그인 세션(sessions).
-- 근거: manyfast REQ-004 계정과 기록 보관, FEAT-015 소셜 로그인과 가입(데이터·비즈니스 규칙),
--       FEAT-017 만 14세 미만 가입 제한, POL-005 개인정보·미성년자 보호 정책, POL-007 기술 아키텍처.
--
-- 접근 방식: 두 테이블은 FastAPI 서버만 서버 키(SUPABASE_SECRET_KEY → service_role)로 Supabase REST(PostgREST)를
-- 거쳐 읽고 쓴다. 브라우저는 Supabase를 직접 부르지 않고 우리 /api만 부른다. 그래서 브라우저용 역할(anon, authenticated)에는
-- 아무 권한도 주지 않는다. 공개 키(publishable key)가 알려지거나 RLS 정책을 잘못 써도 사용자·세션을 읽거나 쓸 수 없게 하려는 것이다.
-- service_role에는 이번 이슈의 서버 코드가 실제로 쓰는 권한만 준다(가입·탈퇴 등은 그 기능을 만드는 이슈의 마이그레이션에서 더한다).

create table public.users (
  id uuid primary key default gen_random_uuid(),
  -- 소셜 로그인 제공자(2026-11-15 결정: 카카오·구글·애플).
  provider text not null check (provider in ('kakao', 'google', 'apple')),
  provider_user_id text not null check (char_length(provider_user_id) between 1 and 255),
  -- 이메일은 비워 둘 수 있다. 카카오는 이메일 제공이 사용자의 선택 동의이고, 애플은 이메일을 가릴 수 있다(manyfast에 근거 없는 판단, PR에서 확인 요청).
  email text check (email is null or char_length(email) between 3 and 320),
  -- 역할 값은 FEAT-015 그대로. 기본값 student는 manyfast에 없는 값이다(PR에서 확인 요청). 멘토 활성화(학생증 인증)는 따로 관리한다.
  role text not null default 'student' check (role in ('student', 'mentor', 'admin')),
  -- 출생연도만 받는다(생년월일·실명은 받지 않는다, POL-005). 가입할 때 필수다(FEAT-015).
  birth_year integer not null check (birth_year >= 1900),
  -- 필수 약관에 동의한 시각. 동의 없이는 가입하지 않는다(FEAT-015).
  terms_agreed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_user_id),
  -- 만 14세 미만은 가입할 수 없다(POL-005). 만 나이는 출생연도와 가입일(한국 시간)로 보수적으로 계산하고
  -- 경계 연도는 14세 미만으로 본다(FEAT-017): 가입 연도 - 출생연도 >= 15일 때만 가입한다. 미래의 출생연도도 여기서 막힌다.
  -- 가입 화면의 안내와 판정은 서버(소셜 로그인 이슈)가 하고, 이 제약은 마지막 방어선이다.
  constraint users_age_14_or_older check (extract(year from (created_at at time zone 'Asia/Seoul')) - birth_year >= 15)
);

comment on table public.users is '캠퍼스하이 계정. FastAPI 서버만 service_role로 접근한다(브라우저 역할 권한 없음).';

create table public.sessions (
  -- 쿠키에는 무작위 토큰만 두고, 여기에는 그 토큰의 SHA-256 해시(16진수 64자)만 둔다. DB가 새도 쿠키를 만들 수 없게 하려는 것이다.
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  -- 계정을 지우면(탈퇴) 그 계정의 세션도 함께 지운다(POL-005: 탈퇴하면 바로 지운다).
  user_id uuid not null references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

-- 로그아웃·탈퇴 때 한 사용자의 세션을 찾는다.
create index sessions_user_id_idx on public.sessions (user_id);

comment on table public.sessions is '로그인 세션. 토큰 해시만 저장한다. FastAPI 서버만 service_role로 접근한다(브라우저 역할 권한 없음).';

-- 권한: 프로젝트의 기본 권한(새 테이블에 자동으로 주는 권한)이 어떻게 설정돼 있든 먼저 모두 거두고, 서버 키에 필요한 것만 준다.
revoke all on table public.users, public.sessions from public, anon, authenticated, service_role;
-- users: 이번 이슈는 세션으로 사용자를 찾기만 한다(가입·정보 수정·탈퇴 권한은 그 이슈에서 더한다).
grant select on table public.users to service_role;
-- sessions: 로그인할 때 만들고, 요청마다 찾고, 로그아웃할 때 지운다. 세션을 고치는 일은 없다.
grant select, insert, delete on table public.sessions to service_role;

-- RLS: 켜 두고 service_role만 허용하는 정책을 둔다. anon·authenticated에는 정책이 없으므로(그리고 권한도 없으므로) 아무 행도 보이지 않는다.
-- Supabase의 service_role은 RLS를 건너뛰지만, 그 설정이 바뀌어도 서버가 동작하도록 정책을 함께 적는다.
alter table public.users enable row level security;
alter table public.sessions enable row level security;

create policy users_server_only on public.users
  for select to service_role
  using (true);

create policy sessions_server_only on public.sessions
  for all to service_role
  using (true)
  with check (true);
