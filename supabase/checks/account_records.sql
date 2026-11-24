-- Non-production transactional QA; all fixtures roll back.
begin;
insert into public.users(id,provider,provider_user_id,email,role,birth_year,terms_agreed_at)
values('00000000-0000-0000-0000-000000000099','email','record-check@example.test','record-check@example.test','student',2000,now());
-- #97 크레딧은 서버가 발급한 시도로만 준다. 1분 전에 시작한 시도 두 개를 둔다.
insert into public.lesson_attempts(id,user_id,course_key,started_at) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000099','khu-cse|이산구조',now()-interval '1 minute'),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000099','khu-cse|이산구조',now()-interval '1 minute');
set local role service_role;
select public.commit_account_records('00000000-0000-0000-0000-000000000099',0,'10000000-0000-0000-0000-000000000001','{"credits":999999,"journeys":{}}','[]');
select public.commit_account_records('00000000-0000-0000-0000-000000000099',1,'10000000-0000-0000-0000-000000000002','{"credits":999999,"journeys":{}}',jsonb_build_array(jsonb_build_object('course_key','khu-cse|이산구조','awarded_at',(extract(epoch from now())*1000)::bigint,'attempt_id','20000000-0000-0000-0000-000000000001')));
do $$ declare d jsonb; begin
 select state into d from public.account_records where user_id='00000000-0000-0000-0000-000000000099';
 if d->>'credits'<>'5' then raise exception 'ledger balance not authoritative'; end if;
 d=public.commit_account_records('00000000-0000-0000-0000-000000000099',0,'10000000-0000-0000-0000-000000000002','{"credits":0}','[]');
 if d->>'status'<>'duplicate' or d->'state'->>'credits'<>'5' then raise exception 'replay changed state'; end if;
 d=public.commit_account_records('00000000-0000-0000-0000-000000000099',0,'10000000-0000-0000-0000-000000000003','{"credits":0}','[]');
 if d->>'status'<>'conflict' then raise exception 'revision conflict ignored'; end if;
 d=public.commit_account_records('00000000-0000-0000-0000-000000000099',2,'10000000-0000-0000-0000-000000000004','{"credits":999999}',jsonb_build_array(jsonb_build_object('course_key','khu-cse|이산구조','awarded_at',(extract(epoch from now())*1000)::bigint,'attempt_id','20000000-0000-0000-0000-000000000002')));
 if d->'state'->>'credits'<>'5' then raise exception 'cooldown failed'; end if;
 if has_table_privilege('service_role','public.account_records','INSERT') then raise exception 'direct write allowed'; end if;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.account_records','SELECT') or has_table_privilege('authenticated','public.account_credit_ledger','SELECT') then raise exception 'private data exposed'; end if;
 if has_function_privilege('anon','public.commit_account_records(uuid,bigint,uuid,jsonb,jsonb)','execute') or has_function_privilege('authenticated','public.commit_account_records(uuid,bigint,uuid,jsonb,jsonb)','execute') then raise exception 'RPC exposed'; end if;
end $$;
rollback;
