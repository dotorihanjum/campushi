begin;
-- #32: 약관 버전과 선택 동의를 남긴다. 멘토 지원은 인증 완료와 구분한다.
alter table public.users add column terms_version text not null default 'legacy-unversioned';
alter table public.users add column privacy_agreed_at timestamptz;
alter table public.users add column marketing_agreed_at timestamptz;
alter table public.users add column mentor_status text not null default 'none' check (mentor_status in ('none','pending','verified','rejected'));

create function public.register_login_account(p_provider text,p_subject text,p_email text,p_birth_year integer,p_role text,p_terms_version text,p_marketing boolean,p_proof_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.users; user_key uuid;
begin
  if p_role is null or p_role not in ('student','mentor') or p_provider is null or p_provider not in ('google','kakao','apple','email')
    or p_birth_year is null or p_birth_year<1900 or extract(year from (now() at time zone 'Asia/Seoul'))-p_birth_year<15
    or p_terms_version is null or char_length(p_terms_version) not between 1 and 80 or p_marketing is null then
    raise check_violation using message='Invalid signup';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_provider||'|'||p_subject,0));
  if not public.consume_auth_challenge(p_proof_hash,'signup') then raise insufficient_privilege; end if;
  select user_id into user_key from public.user_identities where provider=p_provider and provider_user_id=p_subject;
  if user_key is null then
    -- 같은 이메일만으로 기존 계정에 연결하지 않는다.
    if p_email is not null and exists(select 1 from public.users where lower(email)=lower(p_email)) then
      raise unique_violation using message='Reauthentication required';
    end if;
    insert into public.users(provider,provider_user_id,email,birth_year,role,terms_agreed_at,terms_version,privacy_agreed_at,marketing_agreed_at,mentor_status)
    values(p_provider,p_subject,p_email,p_birth_year,p_role,now(),p_terms_version,now(),case when p_marketing then now() else null end,case when p_role='mentor' then 'pending' else 'none' end)
    returning * into saved;
    insert into public.user_identities(provider,provider_user_id,user_id) values(p_provider,p_subject,saved.id);
  else
    select * into saved from public.users where id=user_key;
  end if;
  return to_jsonb(saved);
end; $$;

revoke all on function public.register_login_account(text,text,text,integer,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.register_login_account(text,text,text,integer,text,text,boolean,text) to service_role;
-- users의 직접 INSERT/UPDATE 권한은 늘리지 않는다. 생성은 이 함수로만 허용한다.
comment on function public.register_login_account(text,text,text,integer,text,text,boolean,text) is '서버가 검증한 신원+일회용 인증 해시로만 가입. 나이·역할 검증, 계정·로그인수단을 원자적으로 생성.';
create function public.find_login_account(p_email text) returns jsonb
language sql security definer set search_path='' as $$
  select coalesce(jsonb_agg(found),'[]'::jsonb) from
    (select id,provider from public.users where lower(email)=lower(p_email) limit 2) found;
$$;
revoke all on function public.find_login_account(text) from public,anon,authenticated;
grant execute on function public.find_login_account(text) to service_role;
commit;
