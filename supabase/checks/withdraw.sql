-- #36 회원 탈퇴 검사. 검사용 빈 DB에 roles → 모든 마이그레이션을 적용한 뒤 실행한다. 운영 DB에서 실행하지 않는다. 모두 롤백한다.
create or replace function pg_temp.must_fail(statement text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when insufficient_privilege or check_violation then return;
  end;
  raise exception '거부돼야 하는 요청이 성공함: %', statement;
end; $$;

begin;
-- 탈퇴할 사용자 A와 그대로 남아야 하는 사용자 B. 둘 다 세션·로그인 수단·기록·작업·크레딧 내역을 가진다.
insert into public.users(id,provider,provider_user_id,email,role,birth_year,terms_agreed_at) values
  ('00000000-0000-0000-0000-0000000000a1','email','leaver@example.test','leaver@example.test','student',2008,now()),
  ('00000000-0000-0000-0000-0000000000b2','google','google-stay','stay@example.test','student',2008,now());
insert into public.user_identities(provider,provider_user_id,user_id) values
  ('email','leaver@example.test','00000000-0000-0000-0000-0000000000a1'),
  ('google','google-leaver','00000000-0000-0000-0000-0000000000a1'),
  ('google','google-stay','00000000-0000-0000-0000-0000000000b2');
insert into public.sessions(token_hash,user_id,expires_at) values
  (repeat('a',64),'00000000-0000-0000-0000-0000000000a1',now()+interval '1 day'),
  (repeat('c',64),'00000000-0000-0000-0000-0000000000a1',now()+interval '1 day'),
  (repeat('b',64),'00000000-0000-0000-0000-0000000000b2',now()+interval '1 day');
-- 만료된 세션(created_at을 과거로 둬 check(expires_at > created_at)을 지킨다).
insert into public.sessions(token_hash,user_id,expires_at,created_at) values
  (repeat('e',64),'00000000-0000-0000-0000-0000000000a1',now()-interval '1 minute',now()-interval '2 days');
-- 오래된 임시 인증 데이터와 아직 유효한 다른 사람의 인증.
insert into public.auth_challenges(token_hash,purpose,expires_at,created_at) values
  (repeat('1',64),'email',now()-interval '1 minute',now()-interval '11 minutes'),
  (repeat('2',64),'signup',now()+interval '5 minutes',now());
insert into public.auth_email_limits values
  (repeat('3',64),now()-interval '2 hours',now()-interval '2 hours',1),
  (repeat('4',64),now(),now(),1);

set local role service_role;
select public.commit_account_records('00000000-0000-0000-0000-0000000000a1',0,'20000000-0000-0000-0000-000000000001',
  '{"nickname":"떠날 학생","journeys":{"khu-cse":{}},"records":{"khu-cse|이산구조":{"grade":"A+"}}}',
  jsonb_build_array(jsonb_build_object('course_key','khu-cse|이산구조','awarded_at',(extract(epoch from now())*1000)::bigint)));
select public.commit_account_records('00000000-0000-0000-0000-0000000000b2',0,'20000000-0000-0000-0000-000000000002',
  '{"nickname":"남을 학생","journeys":{"khu-id":{}}}',
  jsonb_build_array(jsonb_build_object('course_key','khu-id|기초디자인','awarded_at',(extract(epoch from now())*1000)::bigint)));

-- 서버 역할도 users를 직접 지울 수 없다(함수로만).
select pg_temp.must_fail('delete from public.users where id=''00000000-0000-0000-0000-0000000000a1''');
select pg_temp.must_fail('select public.delete_account(''00000000-0000-0000-0000-0000000000a1'',''not-a-hash'')');
select pg_temp.must_fail('select public.delete_account(null,repeat(''a'',64))');

do $$ begin
  if public.account_credit_balance('00000000-0000-0000-0000-0000000000a1') <> 5 then raise exception '크레딧 잔액이 원장 합계와 다름'; end if;
  -- 다른 사용자의 세션으로는 지울 수 없다(다른 사용자 id 주입).
  if public.delete_account('00000000-0000-0000-0000-0000000000b2',repeat('a',64)) then raise exception '남의 세션으로 탈퇴됨'; end if;
  if public.delete_account('00000000-0000-0000-0000-0000000000a1',repeat('b',64)) then raise exception '남의 세션으로 탈퇴됨'; end if;
  -- 만료된 세션·없는 세션으로는 지울 수 없다.
  if public.delete_account('00000000-0000-0000-0000-0000000000a1',repeat('e',64)) then raise exception '만료된 세션으로 탈퇴됨'; end if;
  if public.delete_account('00000000-0000-0000-0000-0000000000a1',repeat('f',64)) then raise exception '없는 세션으로 탈퇴됨'; end if;
  if not public.delete_account('00000000-0000-0000-0000-0000000000a1',repeat('a',64)) then raise exception '본인 탈퇴 실패'; end if;
  -- 연타: 같은 세션으로 다시 부르면 이미 없으므로 false.
  if public.delete_account('00000000-0000-0000-0000-0000000000a1',repeat('a',64)) then raise exception '두 번째 탈퇴가 성공으로 보임'; end if;
  if public.delete_account('00000000-0000-0000-0000-0000000000a1',repeat('c',64)) then raise exception '지운 계정의 다른 세션이 남음'; end if;
  if public.account_credit_balance('00000000-0000-0000-0000-0000000000a1') <> 0 then raise exception '탈퇴 뒤 크레딧 내역이 남음'; end if;
  if public.account_credit_balance('00000000-0000-0000-0000-0000000000b2') <> 5 then raise exception '다른 사용자 크레딧이 바뀜'; end if;
end $$;

-- 브라우저 역할은 두 함수 모두 부를 수 없다.
reset role;
set local role anon;
select pg_temp.must_fail('select public.delete_account(''00000000-0000-0000-0000-0000000000b2'',repeat(''b'',64))');
select pg_temp.must_fail('select public.account_credit_balance(''00000000-0000-0000-0000-0000000000b2'')');
reset role;
set local role authenticated;
select pg_temp.must_fail('select public.delete_account(''00000000-0000-0000-0000-0000000000b2'',repeat(''b'',64))');
select pg_temp.must_fail('select public.account_credit_balance(''00000000-0000-0000-0000-0000000000b2'')');
reset role;

do $$
declare a uuid := '00000000-0000-0000-0000-0000000000a1'; b uuid := '00000000-0000-0000-0000-0000000000b2';
begin
  if exists(select 1 from public.users where id=a) or exists(select 1 from public.sessions where user_id=a)
    or exists(select 1 from public.user_identities where user_id=a) or exists(select 1 from public.account_records where user_id=a)
    or exists(select 1 from public.record_operations where user_id=a) or exists(select 1 from public.account_credit_ledger where user_id=a) then
    raise exception 'cascade로 지워지지 않은 행이 있음';
  end if;
  if (select count(*) from public.users where id=b)<>1 or (select count(*) from public.sessions where user_id=b)<>1
    or (select count(*) from public.user_identities where user_id=b)<>1 or (select count(*) from public.account_records where user_id=b)<>1
    or (select count(*) from public.record_operations where user_id=b)<>1 or (select count(*) from public.account_credit_ledger where user_id=b)<>1
    or (select state->>'nickname' from public.account_records where user_id=b)<>'남을 학생' then
    raise exception '다른 사용자 데이터가 바뀜';
  end if;
  -- 만료된 임시 인증 데이터만 정리되고 진행 중인 인증은 남는다.
  if exists(select 1 from public.auth_challenges where token_hash=repeat('1',64)) or not exists(select 1 from public.auth_challenges where token_hash=repeat('2',64)) then
    raise exception '임시 인증 정리 오류';
  end if;
  if exists(select 1 from public.auth_email_limits where mailbox_hash=repeat('3',64)) or not exists(select 1 from public.auth_email_limits where mailbox_hash=repeat('4',64)) then
    raise exception '메일 제한 정리 오류';
  end if;
  -- 권한: users의 직접 DELETE는 아무 역할에도 없다.
  if has_table_privilege('service_role','public.users','DELETE') or has_table_privilege('anon','public.users','DELETE') or has_table_privilege('authenticated','public.users','DELETE') then
    raise exception 'users 직접 삭제 권한이 있음';
  end if;
end $$;

-- 같은 신원으로 다시 가입하면 이전 계정과 다른 새 계정이 생긴다(기존 계정에 연결되지 않음).
insert into public.auth_challenges(token_hash,purpose,expires_at) values(repeat('9',64),'signup',now()+interval '10 minutes');
set local role service_role;
do $$ declare again jsonb; begin
  again := public.register_login_account('email','leaver@example.test','leaver@example.test',2008,'student','development-placeholder-v1',repeat('9',64));
  if again->>'id' = '00000000-0000-0000-0000-0000000000a1' then raise exception '탈퇴한 계정이 되살아남'; end if;
  if public.account_credit_balance((again->>'id')::uuid) <> 0 then raise exception '새 계정에 이전 크레딧이 보임'; end if;
end $$;
reset role;
rollback;
