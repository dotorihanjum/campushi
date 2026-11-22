-- #33: private account documents and idempotent, optimistic transactions.
create table public.account_records (
  user_id uuid primary key references public.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 1048576)
);
create table public.record_operations (
  user_id uuid not null references public.users(id) on delete cascade,
  operation_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(user_id, operation_id)
);
revoke all on public.account_records, public.record_operations from public, anon, authenticated, service_role;
grant select on public.account_records to service_role;
alter table public.account_records enable row level security;
alter table public.record_operations enable row level security;
create policy account_records_server_read on public.account_records for select to service_role using (true);
-- No browser/direct server writes. Rules run in FastAPI; CAS and replay check commit together.
create function public.commit_account_records(p_user_id uuid, p_revision bigint, p_operation_id uuid, p_state jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row public.account_records;
begin
  insert into public.account_records(user_id) values(p_user_id) on conflict do nothing;
  select * into current_row from public.account_records where user_id=p_user_id for update;
  if exists(select 1 from public.record_operations where user_id=p_user_id and operation_id=p_operation_id) then
    return jsonb_build_object('status','duplicate','revision',current_row.revision,'state',current_row.state);
  end if;
  if current_row.revision <> p_revision then
    return jsonb_build_object('status','conflict','revision',current_row.revision,'state',current_row.state);
  end if;
  update public.account_records set revision=revision+1, state=p_state where user_id=p_user_id returning * into current_row;
  insert into public.record_operations(user_id,operation_id) values(p_user_id,p_operation_id);
  return jsonb_build_object('status','saved','revision',current_row.revision,'state',current_row.state);
end;
$$;
revoke all on function public.commit_account_records(uuid,bigint,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.commit_account_records(uuid,bigint,uuid,jsonb) to service_role;
