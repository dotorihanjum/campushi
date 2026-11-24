-- 로그인 유지 연장(이슈 #94, 2026-11-21 원준 결정): 마지막으로 쓴 때부터 30일.
-- 서버(service_role)가 세션의 만료 시각만 늦출 수 있게 한다. 토큰 해시·사용자·만든 시각은 여전히 고칠 수 없다.
-- 서버는 살아 있는 세션(expires_at > now)만 고치므로 로그아웃·탈퇴로 지운 세션과 만료된 세션은 늘어나지 않는다(backend/accounts.py의 renew_session).
grant update (expires_at) on table public.sessions to service_role;

comment on table public.sessions is '로그인 세션. 토큰 해시만 저장한다. FastAPI 서버만 service_role로 접근한다(브라우저 역할 권한 없음). 쓸 때마다 expires_at을 늦춘다(#94).';
