-- #34: server credit ledger; clients cannot set a balance or call this RPC.
create table public.account_credit_ledger (
  user_id uuid not null references public.users(id) on delete cascade,
  operation_id uuid not null,
  course_key text not null check(char_length(course_key) between 3 and 300),
  amount integer not null default 5 check(amount=5),
  awarded_at bigint not null check(awarded_at>0),
  primary key(user_id,operation_id,course_key)
);
revoke all on public.account_credit_ledger from public, anon, authenticated, service_role;
alter table public.account_credit_ledger enable row level security;
grant select on public.record_operations to service_role;
create policy record_operations_server_read on public.record_operations for select to service_role using(true);
drop function public.commit_account_records(uuid,bigint,uuid,jsonb);
create function public.commit_account_records(p_user_id uuid, p_revision bigint, p_operation_id uuid, p_state jsonb, p_awards jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row public.account_records; award jsonb; balance bigint;
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
      insert into public.account_credit_ledger(user_id,operation_id,course_key,awarded_at) values(p_user_id,p_operation_id,award->>'course_key',(award->>'awarded_at')::bigint);
    end if;
  end loop;
  select coalesce(sum(amount),0) into balance from public.account_credit_ledger where user_id=p_user_id;
  p_state=jsonb_set(p_state,'{credits}',to_jsonb(balance));
  update public.account_records set revision=revision+1,state=p_state where user_id=p_user_id returning * into current_row;
  insert into public.record_operations(user_id,operation_id) values(p_user_id,p_operation_id);
  return jsonb_build_object('status','saved','revision',current_row.revision,'state',current_row.state);
end;
$$;
revoke all on function public.commit_account_records(uuid,bigint,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_account_records(uuid,bigint,uuid,jsonb,jsonb) to service_role;
