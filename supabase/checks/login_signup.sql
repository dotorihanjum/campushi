-- 검사용 빈 DB에 roles → account_base → login → signup 마이그레이션을 적용한 뒤 실행한다. 운영 DB에서 실행하지 않는다.
create or replace function pg_temp.must_fail(statement text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when insufficient_privilege or check_violation or unique_violation then return;
  end;
  raise exception '거부돼야 하는 요청이 성공함: %',statement;
end; $$;

begin;
set local role anon;
select pg_temp.must_fail('select * from public.user_identities');
select pg_temp.must_fail('select * from public.auth_challenges');
select pg_temp.must_fail('select public.begin_email_login(repeat(''a'',64), repeat(''b'',64))');
set local role authenticated;
select pg_temp.must_fail('select * from public.auth_email_limits');
select pg_temp.must_fail('select public.register_login_account(''email'',''x@example.test'',''x@example.test'',2000,''student'',''v1'',false,repeat(''c'',64))');
set local role service_role;
select pg_temp.must_fail('insert into public.users(provider,provider_user_id,birth_year,terms_agreed_at) values(''email'',''bypass@example.test'',2000,now())');

do $$
begin
  if not public.begin_email_login(repeat('a',64),repeat('b',64)) then raise exception '첫 메일 실패'; end if;
  if public.begin_email_login(repeat('c',64),repeat('b',64)) then raise exception '연타 메일 허용됨'; end if;
  if not public.consume_auth_challenge(repeat('a',64),'email') then raise exception '첫 링크 실패'; end if;
  if public.consume_auth_challenge(repeat('a',64),'email') then raise exception '링크 재사용 허용됨'; end if;
end; $$;

insert into public.auth_challenges(token_hash,purpose,expires_at) values(repeat('d',64),'signup',now()+interval '10 minutes');
select pg_temp.must_fail(format('select public.register_login_account(''email'',''age@example.test'',''age@example.test'',%s,''student'',''dev-v1'',false,repeat(''d'',64))',extract(year from now() at time zone 'Asia/Seoul')::integer-14));
select pg_temp.must_fail('select public.register_login_account(''email'',''age@example.test'',''age@example.test'',2000,''admin'',''dev-v1'',false,repeat(''d'',64))');

do $$
declare result jsonb; result2 jsonb;
begin
  if exists(select 1 from public.users where email='age@example.test') then raise exception '나이 제한 우회'; end if;
  result := public.register_login_account('email','adult@example.test','adult@example.test',2000,'mentor','development-placeholder-v1',false,repeat('d',64));
  if result->>'mentor_status'<>'pending' or result->>'terms_version'<>'development-placeholder-v1' then raise exception '지원·동의 기록 오류'; end if;
  if result->>'marketing_agreed_at' is not null then raise exception '선택 동의 강요'; end if;
  if jsonb_array_length(public.find_login_account('ADULT@example.test'))<>1 then raise exception '이메일 대소문자 비교 오류'; end if;
  insert into public.auth_challenges(token_hash,purpose,expires_at) values(repeat('e',64),'signup',now()+interval '10 minutes');
  result2 := public.register_login_account('email','adult@example.test','adult@example.test',2000,'student','v2',true,repeat('e',64));
  if result->>'id'<>result2->>'id' then raise exception '중복 계정 생성'; end if;
end; $$;
select pg_temp.must_fail('select public.register_login_account(''email'',''adult@example.test'',''adult@example.test'',2000,''student'',''v1'',false,repeat(''d'',64))');
-- 메일 주소를 바꿔도 앱 전체 발송 제한은 우회하지 못한다.
reset role;
insert into public.auth_email_limits(mailbox_hash,window_start,last_sent,sent)
select lpad(to_hex(i),64,'0'),now(),now(),1 from generate_series(1,99) i;
set local role service_role;
do $$ begin
  if public.begin_email_login(repeat('f',64),repeat('0',64)) then raise exception '전체 메일 제한 우회'; end if;
end; $$;
rollback;
