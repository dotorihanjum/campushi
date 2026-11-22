begin;
-- #31: 기존 계정·세션을 유지하며 검증된 로그인 수단만 연결한다.
alter table public.users drop constraint users_provider_check;
alter table public.users add constraint users_provider_check check (provider in ('kakao','google','apple','email'));

create table public.user_identities (
  provider text not null check (provider in ('kakao','google','apple','email')),
  provider_user_id text not null check (char_length(provider_user_id) between 1 and 255),
  user_id uuid not null references public.users(id) on delete cascade,
  primary key (provider, provider_user_id)
);
insert into public.user_identities(provider,provider_user_id,user_id)
select provider,provider_user_id,id from public.users;
create index user_identities_user_idx on public.user_identities(user_id);

-- 인증 중 임시 데이터는 브라우저의 서명된 HttpOnly 쿠키에만 둔다.
-- DB에는 재사용 방지용 무작위 값의 해시만 남기며 이메일·소셜 ID·출생연도는 저장하지 않는다.
create table public.auth_challenges (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  purpose text not null check (purpose in ('email','signup')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '15 minutes')
);
create index auth_challenges_expiry_idx on public.auth_challenges(expires_at);
create table public.auth_email_limits (
  mailbox_hash text primary key check (mailbox_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  last_sent timestamptz not null,
  sent integer not null check (sent between 1 and 5)
);

revoke all on public.user_identities, public.auth_challenges, public.auth_email_limits from public,anon,authenticated,service_role;
grant select on public.user_identities to service_role;
grant insert on public.auth_challenges to service_role;
alter table public.user_identities enable row level security;
alter table public.auth_challenges enable row level security;
alter table public.auth_email_limits enable row level security;
create policy identities_server_read on public.user_identities for select to service_role using (true);
create policy challenges_server_insert on public.auth_challenges for insert to service_role with check (true);
-- auth_email_limits는 아래 서버 전용 함수만 접근한다. 브라우저 정책·권한은 없다.

create function public.consume_auth_challenge(p_hash text,p_purpose text) returns boolean
language plpgsql security definer set search_path='' as $$
declare found_hash text;
begin
  delete from public.auth_challenges where token_hash=p_hash and purpose=p_purpose and expires_at>now() returning token_hash into found_hash;
  return found_hash is not null;
end; $$;

create function public.begin_email_login(p_hash text,p_mailbox_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare limits public.auth_email_limits;
begin
  if not coalesce(p_hash ~ '^[0-9a-f]{64}$',false) or not coalesce(p_mailbox_hash ~ '^[0-9a-f]{64}$',false) then
    raise check_violation;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('campushi-email-global',0));
  delete from public.auth_challenges where expires_at<=now();
  delete from public.auth_email_limits where window_start < now()-interval '1 hour';
  if (select coalesce(sum(sent),0) from public.auth_email_limits)>=100 then return false; end if;
  select * into limits from public.auth_email_limits where mailbox_hash=p_mailbox_hash;
  if found and (limits.last_sent>now()-interval '1 minute' or limits.sent>=5) then return false; end if;
  insert into public.auth_email_limits values (p_mailbox_hash,now(),now(),1)
  on conflict(mailbox_hash) do update set last_sent=now(), sent=public.auth_email_limits.sent+1;
  insert into public.auth_challenges(token_hash,purpose,expires_at) values (p_hash,'email',now()+interval '10 minutes');
  return true;
end; $$;

create function public.link_login_identity(p_user_id uuid,p_provider text,p_subject text,p_email text,p_proof_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare email text;
begin
  select lower(users.email) into email from public.users where id=p_user_id for update;
  if email is null or email is distinct from lower(p_email) or not public.consume_auth_challenge(p_proof_hash,'signup') then
    raise insufficient_privilege;
  end if;
  insert into public.user_identities(provider,provider_user_id,user_id) values(p_provider,p_subject,p_user_id);
  return true;
end; $$;

revoke all on function public.consume_auth_challenge(text,text),public.begin_email_login(text,text),public.link_login_identity(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.consume_auth_challenge(text,text),public.begin_email_login(text,text),public.link_login_identity(uuid,text,text,text,text) to service_role;
comment on table public.user_identities is '서버에서 검증한 로그인 수단. 같은 이메일만으로 계정을 자동 연결하지 않는다.';
comment on table public.auth_challenges is '10분 인증·가입 재사용 방지 해시. 개인정보 없음. 만료 행은 다음 이메일 요청에서 정리.';
commit;
