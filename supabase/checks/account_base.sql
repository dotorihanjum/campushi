-- 마이그레이션 20261118120000_account_base.sql 검사(이슈 #30). 운영 DB에는 절대 돌리지 않는다.
-- supabase/checks/는 Supabase가 자동으로 적용하지 않는 폴더다(자동 적용은 supabase/migrations/만).
--
-- 빈 Postgres(15 이상)에 Supabase의 역할만 흉내 내고 마이그레이션을 적용한 뒤 이 파일을 돌린다. 하나라도 틀리면 오류로 멈춘다.
--   docker run --rm -d --name campushi-pg -e POSTGRES_PASSWORD=pg -p 55432:5432 postgres:17
--   docker exec -i campushi-pg psql -U postgres -v ON_ERROR_STOP=1 < supabase/checks/supabase_roles.sql
--   docker exec -i campushi-pg psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261118120000_account_base.sql
--   docker exec -i campushi-pg psql -U postgres -v ON_ERROR_STOP=1 < supabase/checks/account_base.sql
--   docker rm -f campushi-pg

-- 문장이 실패해야 하는지 확인한다(실패하지 않으면 오류). 실패 이유(SQLSTATE)도 맞아야 한다.
create or replace function pg_temp.expect_fail(statement text, expected_state text, label text) returns void
language plpgsql as $$
begin
  execute statement;
  raise exception '실패해야 하는데 통과함: %', label;
exception
  when others then
    if sqlstate = 'P0001' and sqlerrm like '실패해야 하는데 통과함%' then
      raise;
    end if;
    if sqlstate <> expected_state then
      raise exception '%: SQLSTATE %가 나와야 하는데 % (%)', label, expected_state, sqlstate, sqlerrm;
    end if;
    raise notice '통과(거부됨): %', label;
end;
$$;

begin;

-- 1. 만 14세 판정: 가입 연도(한국 시간) - 출생연도 >= 15만 통과.
do $$
declare
  this_year integer := extract(year from (now() at time zone 'Asia/Seoul'))::integer;
begin
  insert into public.users (provider, provider_user_id, birth_year, terms_agreed_at)
  values ('kakao', 'age-15', this_year - 15, now());
  raise notice '통과(허용됨): 올해 - 15년 출생';
end;
$$;

select pg_temp.expect_fail(
  format($q$insert into public.users (provider, provider_user_id, birth_year, terms_agreed_at) values ('kakao', 'age-14', %s, now())$q$,
         extract(year from (now() at time zone 'Asia/Seoul'))::integer - 14),
  '23514', '올해 - 14년 출생(경계 연도는 14세 미만)');

select pg_temp.expect_fail(
  format($q$insert into public.users (provider, provider_user_id, birth_year, terms_agreed_at) values ('kakao', 'future', %s, now())$q$,
         extract(year from (now() at time zone 'Asia/Seoul'))::integer + 1),
  '23514', '미래 출생연도');

select pg_temp.expect_fail(
  $q$insert into public.users (provider, provider_user_id, birth_year, terms_agreed_at) values ('kakao', 'old', 1899, now())$q$,
  '23514', '1899년 출생');

do $$
begin
  insert into public.users (provider, provider_user_id, birth_year, terms_agreed_at) values ('google', 'y1900', 1900, now());
  raise notice '통과(허용됨): 1900년 출생';
end;
$$;

-- 가입 연도는 UTC가 아니라 한국 시간으로 센다: 2026-12-31 15:30 UTC는 한국 시간 2027-01-01 00:30이다.
do $$
begin
  insert into public.users (provider, provider_user_id, birth_year, terms_agreed_at, created_at)
  values ('apple', 'kst-new-year', 2012, '2026-12-31T15:30:00Z', '2026-12-31T15:30:00Z');
  raise notice '통과(허용됨): 한국 시간 2027-01-01 가입, 2012년 출생';
end;
$$;

select pg_temp.expect_fail(
  $q$insert into public.users (provider, provider_user_id, birth_year, terms_agreed_at, created_at) values ('apple', 'kst-last-day', 2012, '2026-12-31T14:30:00Z', '2026-12-31T14:30:00Z')$q$,
  '23514', '한국 시간 2026-12-31 가입, 2012년 출생');

-- 2. 필수 값과 허용 값.
select pg_temp.expect_fail(
  $q$insert into public.users (provider, provider_user_id, birth_year, terms_agreed_at) values ('kakao', 'no-birth', null, now())$q$,
  '23502', '출생연도 없음');
select pg_temp.expect_fail(
  $q$insert into public.users (provider, provider_user_id, birth_year, terms_agreed_at) values ('kakao', 'no-terms', 2000, null)$q$,
  '23502', '약관 동의 시각 없음');
select pg_temp.expect_fail(
  $q$insert into public.users (provider, provider_user_id, birth_year, terms_agreed_at) values ('naver', 'x', 2000, now())$q$,
  '23514', '허용하지 않는 제공자');
select pg_temp.expect_fail(
  $q$insert into public.users (provider, provider_user_id, birth_year, terms_agreed_at, role) values ('kakao', 'x', 2000, now(), 'teacher')$q$,
  '23514', '허용하지 않는 역할');
select pg_temp.expect_fail(
  $q$insert into public.users (provider, provider_user_id, birth_year, terms_agreed_at) values ('kakao', 'age-15', 2000, now())$q$,
  '23505', '같은 제공자의 같은 사용자 id');

do $$
declare
  saved record;
begin
  -- 다른 제공자면 같은 사용자 id여도 된다. 이메일은 비워 둘 수 있고 역할 기본값은 student다.
  insert into public.users (provider, provider_user_id, birth_year, terms_agreed_at) values ('google', 'age-15', 2000, now())
  returning email, role into saved;
  if saved.email is not null or saved.role <> 'student' then
    raise exception '기본값이 다름: email %, role %', saved.email, saved.role;
  end if;
  raise notice '통과: 이메일 비움, 역할 기본값 student';
end;
$$;

-- 3. 세션: 토큰 해시 형식, 만료 시각, 계정을 지우면 세션도 지워짐.
select pg_temp.expect_fail(
  $q$insert into public.sessions (token_hash, user_id, expires_at) select 'plain-token', id, now() + interval '1 day' from public.users limit 1$q$,
  '23514', '해시가 아닌 토큰');
select pg_temp.expect_fail(
  $q$insert into public.sessions (token_hash, user_id, expires_at) select repeat('a', 64), id, now() - interval '1 second' from public.users limit 1$q$,
  '23514', '이미 지난 만료 시각');

do $$
declare
  account uuid;
begin
  select id into account from public.users where provider = 'kakao' and provider_user_id = 'age-15';
  insert into public.sessions (token_hash, user_id, expires_at) values (repeat('b', 64), account, now() + interval '30 days');
  delete from public.users where id = account;
  if exists (select 1 from public.sessions where token_hash = repeat('b', 64)) then
    raise exception '계정을 지웠는데 세션이 남음';
  end if;
  raise notice '통과: 계정을 지우면 세션도 지워짐';
end;
$$;

-- 4. 권한: 브라우저 역할은 아무것도 못 하고, 서버 키는 필요한 것만 한다.
insert into public.sessions (token_hash, user_id, expires_at)
select repeat('c', 64), id, now() + interval '1 day' from public.users where provider_user_id = 'y1900';

set local role anon;
select pg_temp.expect_fail('select 1 from public.users', '42501', 'anon이 users 읽기');
select pg_temp.expect_fail('select 1 from public.sessions', '42501', 'anon이 sessions 읽기');
select pg_temp.expect_fail($q$insert into public.sessions (token_hash, user_id, expires_at) values (repeat('d', 64), gen_random_uuid(), now() + interval '1 day')$q$, '42501', 'anon이 세션 만들기');
reset role;

set local role authenticated;
select pg_temp.expect_fail('select 1 from public.users', '42501', 'authenticated가 users 읽기');
select pg_temp.expect_fail('select 1 from public.sessions', '42501', 'authenticated가 sessions 읽기');
reset role;

set local role service_role;
do $$
declare
  account uuid;
  found integer;
begin
  select id into account from public.users where provider_user_id = 'y1900';
  select count(*) into found from public.sessions where token_hash = repeat('c', 64) and user_id = account;
  if found <> 1 then
    raise exception 'service_role이 세션을 못 읽음';
  end if;
  insert into public.sessions (token_hash, user_id, expires_at) values (repeat('e', 64), account, now() + interval '1 day');
  delete from public.sessions where token_hash = repeat('e', 64);
  raise notice '통과: service_role은 users 읽기, sessions 읽기·만들기·지우기';
end;
$$;
select pg_temp.expect_fail($q$update public.sessions set expires_at = now() + interval '9 days'$q$, '42501', 'service_role이 세션 고치기');
select pg_temp.expect_fail($q$insert into public.users (provider, provider_user_id, birth_year, terms_agreed_at) values ('kakao', 'srv', 2000, now())$q$, '42501', 'service_role이 사용자 만들기(이번 이슈 범위 밖)');
select pg_temp.expect_fail($q$delete from public.users$q$, '42501', 'service_role이 사용자 지우기(이번 이슈 범위 밖)');
reset role;

-- 5. RLS가 켜져 있다.
do $$
begin
  if exists (select 1 from pg_class where oid in ('public.users'::regclass, 'public.sessions'::regclass) and not relrowsecurity) then
    raise exception 'RLS가 꺼진 테이블이 있음';
  end if;
  raise notice '통과: users·sessions RLS 켜짐';
end;
$$;

rollback;

select '모든 검사 통과' as result;
