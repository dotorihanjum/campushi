-- 검사용 빈 Postgres에 Supabase가 미리 만들어 두는 역할만 흉내 낸다(account_base.sql 사용법 참고). 운영 DB에는 돌리지 않는다.
-- service_role은 Supabase처럼 RLS를 건너뛰지 않게 만들어, 마이그레이션의 정책만으로도 서버가 동작하는지 함께 본다.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$$;
grant usage on schema public to anon, authenticated, service_role;
-- 예전 Supabase 프로젝트처럼 새 테이블에 세 역할 모두 모든 권한이 자동으로 붙는 가장 나쁜 경우를 흉내 낸다.
-- 마이그레이션이 이것을 거두고 필요한 권한만 남기는지 account_base.sql이 확인한다.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
