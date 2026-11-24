-- #97 크레딧 부정 적립 막기(2026-11-23 사용자 결정: 방법 A, 서버가 체험 시도를 발급).
-- 수업 화면을 열면 서버가 그 과목의 시도를 발급한다. 크레딧은 발급된 시도로 마친 이수에만 준다:
-- 같은 사용자·같은 과목, 한 번만, 시작하고 20초가 지난 뒤, 하루 안에. 시도 없이 complete만 보내면 성적은 남아도 크레딧은 없다.
-- 문제와 정답은 지금처럼 브라우저에 있으므로 자동으로 푸는 스크립트까지 막지는 않는다(서버 출제·채점은 결제를 열 때 다시 판단).
create table public.lesson_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  course_key text not null check (char_length(course_key) between 3 and 300),
  started_at timestamptz not null default now(),
  -- 이 시도로 크레딧을 준 작업(record_operations.operation_id). 비어 있으면 아직 쓰지 않았다.
  used_by uuid
);
create index lesson_attempts_user_started_idx on public.lesson_attempts (user_id, started_at desc);
comment on table public.lesson_attempts is '체험 시도(#97). 서버 함수(start_lesson_attempt, commit_account_records)로만 만들고 쓴다.';

-- 표에는 아무 역할도 직접 닿지 않는다. 아래 security definer 함수만 읽고 쓴다.
revoke all on table public.lesson_attempts from public, anon, authenticated, service_role;
alter table public.lesson_attempts enable row level security;

-- 시도 발급. 한 사용자가 한 시간에 60번까지만 시작할 수 있다(넘으면 null). 하루가 지난 시도는 이때 지운다.
create function public.start_lesson_attempt(p_user_id uuid, p_course_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare attempt uuid;
begin
  if p_course_key is null or char_length(p_course_key) not between 3 and 300 then
    raise exception 'bad course key';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 97));
  delete from public.lesson_attempts where user_id = p_user_id and started_at < now() - interval '1 day';
  if (select count(*) from public.lesson_attempts where user_id = p_user_id and started_at > now() - interval '1 hour') >= 60 then
    return null;
  end if;
  insert into public.lesson_attempts (user_id, course_key) values (p_user_id, p_course_key) returning id into attempt;
  return attempt;
end;
$$;
revoke all on function public.start_lesson_attempt(uuid, text) from public, anon, authenticated;
grant execute on function public.start_lesson_attempt(uuid, text) to service_role;

-- 기록 확정(20261120000400_record_sync.sql)과 같지만, 크레딧 지급마다 그 과목의 쓰지 않은 시도를 하나 써야 한다.
-- 시도가 없거나 맞지 않으면 그 지급만 건너뛰고 기록은 저장한다(잔액·지급 시각은 늘 장부에서 다시 계산한다).
create or replace function public.commit_account_records(p_user_id uuid, p_revision bigint, p_operation_id uuid, p_state jsonb, p_awards jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row public.account_records; award jsonb; balance bigint; credited jsonb; attempt uuid;
begin
  insert into public.account_records(user_id) values(p_user_id) on conflict do nothing;
  select * into current_row from public.account_records where user_id=p_user_id for update;
  if exists(select 1 from public.record_operations where user_id=p_user_id and operation_id=p_operation_id) then
    return jsonb_build_object('status','duplicate','revision',current_row.revision,'state',current_row.state);
  end if;
  if current_row.revision<>p_revision then
    return jsonb_build_object('status','conflict','revision',current_row.revision,'state',current_row.state);
  end if;
  for award in select * from jsonb_array_elements(p_awards) loop
    -- Defense in depth: a malformed/retried grant cannot bypass the server-time cooldown.
    if (award->>'awarded_at')::bigint > (extract(epoch from now())*1000)::bigint+60000 then raise exception 'future award'; end if;
    if not exists(select 1 from public.account_credit_ledger where user_id=p_user_id and course_key=award->>'course_key' and awarded_at>(award->>'awarded_at')::bigint-604800000) then
      attempt := case when award->>'attempt_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (award->>'attempt_id')::uuid end;
      -- #97 the attempt must be this user's, for this course, unused, started at least 20 seconds and at most a day ago.
      update public.lesson_attempts set used_by=p_operation_id
        where id=attempt and user_id=p_user_id and course_key=award->>'course_key' and used_by is null
          and started_at<=now()-interval '20 seconds' and started_at>now()-interval '1 day';
      if found then
        insert into public.account_credit_ledger(user_id,operation_id,course_key,awarded_at) values(p_user_id,p_operation_id,award->>'course_key',(award->>'awarded_at')::bigint);
      end if;
    end if;
  end loop;
  select coalesce(sum(amount),0) into balance from public.account_credit_ledger where user_id=p_user_id;
  p_state=jsonb_set(p_state,'{credits}',to_jsonb(balance));
  select coalesce(jsonb_object_agg(course_key,last_award),'{}'::jsonb) into credited from (select course_key,max(awarded_at) as last_award from public.account_credit_ledger where user_id=p_user_id group by course_key) history;
  p_state=jsonb_set(p_state,'{creditedAt}',credited);
  update public.account_records set revision=revision+1,state=p_state where user_id=p_user_id returning * into current_row;
  insert into public.record_operations(user_id,operation_id) values(p_user_id,p_operation_id);
  return jsonb_build_object('status','saved','revision',current_row.revision,'state',current_row.state);
end;
$$;
revoke all on function public.commit_account_records(uuid,bigint,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_account_records(uuid,bigint,uuid,jsonb,jsonb) to service_role;
