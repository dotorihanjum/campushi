begin;
-- #36 회원 탈퇴: 세션 소유자 계정을 한 트랜잭션 안에서 바로 지운다(POL-005: 탈퇴하면 바로 지운다).
-- users 행을 지우면 on delete cascade로 sessions, user_identities, account_records, record_operations,
-- account_credit_ledger가 함께 지워진다. user_identities가 사라지므로 같은 소셜·이메일 신원으로 다시 오면 새 가입 흐름으로 간다.
-- users의 직접 DELETE 권한은 주지 않는다. 서버는 세션 토큰 해시를 함께 보내야 하고, 그 세션의 주인만 지울 수 있다.

create function public.delete_account(p_user_id uuid, p_token_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare removed uuid;
begin
  if p_user_id is null or not coalesce(p_token_hash ~ '^[0-9a-f]{64}$', false) then
    raise check_violation using message = 'Invalid withdrawal';
  end if;
  -- 같은 계정의 기록 저장(commit_account_records)과 겹치면 account_records 행 잠금을 기다린 뒤 지운다.
  delete from public.users u
  where u.id = p_user_id
    and exists(select 1 from public.sessions s where s.token_hash = p_token_hash and s.user_id = p_user_id and s.expires_at > now())
  returning u.id into removed;
  -- user_id로 이어지지 않는 임시 인증 데이터(무작위 해시·키 해시, 개인정보 없음)는 만료된 것만 함께 정리한다.
  -- 아직 유효한 행은 다른 사용자의 진행 중인 인증일 수 있어 남긴다(최대 15분·1시간 뒤 만료).
  delete from public.auth_challenges where expires_at <= now();
  delete from public.auth_email_limits where window_start < now() - interval '1 hour';
  return removed is not null;
end;
$$;

-- 탈퇴 확인 화면의 "소멸하는 크레딧". 잔액은 지급 원장 합계이고, 서버는 원장을 직접 읽을 권한이 없다.
create function public.account_credit_balance(p_user_id uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount), 0)::bigint from public.account_credit_ledger where user_id = p_user_id;
$$;

revoke all on function public.delete_account(uuid, text), public.account_credit_balance(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid, text), public.account_credit_balance(uuid) to service_role;
comment on function public.delete_account(uuid, text) is '세션 소유자 계정 즉시 삭제(cascade). 세션이 없거나 만료·다른 사용자면 false.';
commit;
