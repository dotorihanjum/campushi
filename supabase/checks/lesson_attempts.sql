-- #97 체험 시도 검사. 검사용 빈 DB에 roles → 모든 마이그레이션을 적용한 뒤 실행한다. 운영 DB에서 실행하지 않는다. 모두 롤백한다.
begin;
insert into public.users(id,provider,provider_user_id,email,role,birth_year,terms_agreed_at) values
 ('00000000-0000-0000-0000-0000000097a1','email','attempt-a@example.test','attempt-a@example.test','student',2000,now()),
 ('00000000-0000-0000-0000-0000000097b2','email','attempt-b@example.test','attempt-b@example.test','student',2000,now());

-- 시험용 시도: 1분 전에 시작(쓸 수 있음), 방금 시작(20초 전), 이틀 전 시작(만료), 다른 사용자, 다른 과목.
insert into public.lesson_attempts(id,user_id,course_key,started_at) values
 ('97000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000097a1','khu-cse|이산구조',now()-interval '1 minute'),
 ('97000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000097a1','khu-cse|선형대수',now()),
 ('97000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000097a1','khu-cse|미분적분학',now()-interval '2 days'),
 ('97000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000097b2','khu-cse|미분방정식',now()-interval '1 minute'),
 ('97000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000097a1','khu-cse|운영체제',now()-interval '1 minute');

set local role service_role;
do $$
declare
  a constant uuid := '00000000-0000-0000-0000-0000000097a1';
  d jsonb;
  rev bigint := 0;
  t bigint := (extract(epoch from now())*1000)::bigint;
  issued uuid;
  award jsonb;
begin
  -- 1. 시도 없이, 잘못된 번호로, 없는 번호로 보낸 지급은 장부에 들어가지 않는다(기록은 저장된다).
  for award in select * from jsonb_array_elements(jsonb_build_array(
      jsonb_build_object('course_key','khu-cse|이산구조','awarded_at',t),
      jsonb_build_object('course_key','khu-cse|이산구조','awarded_at',t,'attempt_id','not-a-uuid'),
      jsonb_build_object('course_key','khu-cse|이산구조','awarded_at',t,'attempt_id','97000000-0000-0000-0000-0000000000ff'))) loop
    d := public.commit_account_records(a, rev, gen_random_uuid(), '{"credits":999}', jsonb_build_array(award));
    rev := (d->>'revision')::bigint;
    if d->>'status'<>'saved' or d->'state'->>'credits'<>'0' then raise exception '시도 없는 지급이 통과함: %', award; end if;
  end loop;
  raise notice '통과: 시도 없는 complete는 크레딧 0';

  -- 2. 방금 시작한 시도(20초 안), 만료된 시도, 다른 사용자의 시도, 다른 과목의 시도는 쓰지 못한다.
  for award in select * from jsonb_array_elements(jsonb_build_array(
      jsonb_build_object('course_key','khu-cse|선형대수','awarded_at',t,'attempt_id','97000000-0000-0000-0000-000000000002'),
      jsonb_build_object('course_key','khu-cse|미분적분학','awarded_at',t,'attempt_id','97000000-0000-0000-0000-000000000003'),
      jsonb_build_object('course_key','khu-cse|미분방정식','awarded_at',t,'attempt_id','97000000-0000-0000-0000-000000000004'),
      jsonb_build_object('course_key','khu-cse|이산구조','awarded_at',t,'attempt_id','97000000-0000-0000-0000-000000000005'))) loop
    d := public.commit_account_records(a, rev, gen_random_uuid(), '{}', jsonb_build_array(award));
    rev := (d->>'revision')::bigint;
    if d->'state'->>'credits'<>'0' then raise exception '맞지 않는 시도가 통과함: %', award; end if;
  end loop;
  raise notice '통과: 20초 안·하루 지난·남의·다른 과목 시도는 크레딧 0, 시도는 그대로';

  -- 3. 맞는 시도는 한 번만 쓴다. 같은 시도로 다른 작업을 보내도(7일 규칙을 피하려 지급 시각을 바꿔도) 다시 주지 않는다.
  d := public.commit_account_records(a, rev, '97100000-0000-0000-0000-000000000001', '{}', jsonb_build_array(
    jsonb_build_object('course_key','khu-cse|이산구조','awarded_at',t,'attempt_id','97000000-0000-0000-0000-000000000001')));
  rev := (d->>'revision')::bigint;
  if d->'state'->>'credits'<>'5' then raise exception '맞는 시도로 크레딧을 못 받음'; end if;
  d := public.commit_account_records(a, rev, gen_random_uuid(), '{}', jsonb_build_array(
    jsonb_build_object('course_key','khu-cse|이산구조','awarded_at',t-8*86400000,'attempt_id','97000000-0000-0000-0000-000000000001')));
  rev := (d->>'revision')::bigint;
  if d->'state'->>'credits'<>'5' then raise exception '쓴 시도를 다시 씀'; end if;
  raise notice '통과: 맞는 시도는 5크레딧, 같은 시도는 두 번 못 씀';

  -- 4. 발급: 과목 키를 검사하고, 한 시간에 60번까지만 발급한다.
  issued := public.start_lesson_attempt(a, 'khu-cse|이산구조');
  if issued is null then raise exception '시도를 발급하지 못함'; end if;
  for i in 1..60 loop issued := public.start_lesson_attempt(a, 'khu-cse|이산구조'); end loop;
  if issued is not null then raise exception '한 시간 발급 한도가 없음'; end if;
  raise notice '통과: 시도 발급과 한 시간 60번 한도';
end;
$$;
do $$ begin
  begin
    perform public.start_lesson_attempt('00000000-0000-0000-0000-0000000097b2', 'x');
    raise exception '짧은 과목 키가 통과함';
  exception when raise_exception then
    if sqlerrm <> 'bad course key' then raise; end if;
  end;
  raise notice '통과: 잘못된 과목 키 거부';
end $$;

-- 5. 서버 키도 표를 직접 읽거나 쓰지 못한다(함수로만).
do $$ begin
  if has_table_privilege('service_role','public.lesson_attempts','SELECT')
     or has_table_privilege('service_role','public.lesson_attempts','INSERT')
     or has_table_privilege('service_role','public.lesson_attempts','UPDATE') then
    raise exception 'service_role이 시도 표에 직접 닿음';
  end if;
  raise notice '통과: 시도 표는 함수로만';
end $$;
reset role;
-- 3의 이어서(시도 표는 서버 키로 읽을 수 없어 여기서 본다): 크레딧을 준 시도만 쓰임으로 남는다.
do $$ begin
  if (select used_by from public.lesson_attempts where id='97000000-0000-0000-0000-000000000001') is distinct from '97100000-0000-0000-0000-000000000001' then
    raise exception '쓴 작업이 남지 않음';
  end if;
  if exists(select 1 from public.lesson_attempts where used_by is not null and id<>'97000000-0000-0000-0000-000000000001') then
    raise exception '지급하지 않은 시도가 쓰임으로 표시됨';
  end if;
  raise notice '통과: 크레딧을 준 시도만 쓰임으로 남음';
end $$;
do $$ begin
  if has_table_privilege('anon','public.lesson_attempts','SELECT') or has_table_privilege('authenticated','public.lesson_attempts','SELECT') then raise exception '시도 표 노출'; end if;
  if has_function_privilege('anon','public.start_lesson_attempt(uuid,text)','execute') or has_function_privilege('authenticated','public.start_lesson_attempt(uuid,text)','execute') then raise exception '발급 함수 노출'; end if;
  raise notice '통과: 브라우저 역할에는 표·함수 권한 없음';
end $$;
rollback;
