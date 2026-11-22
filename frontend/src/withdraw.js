// #36 회원 탈퇴 화면 문구. 크레딧 소멸 문구는 출시 전 법률 검토 대상이다.
import { PROVIDER_NAMES } from "./login.js";

export const CREDIT_FORFEIT = "탈퇴하면 크레딧은 소멸하고 되살리거나 환불하지 않아요.";

// 실패했을 때 사용자가 다음에 할 일을 알 수 있는 문장. 연결이 끊긴 경우는 서버가 처리했는지 알 수 없으므로 "그대로예요"라고 하지 않는다.
export function withdrawFailure(error) {
  if (error?.status === 0) return "서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.";
  if (error?.status === 401) return "로그인이 만료되어 탈퇴할 수 없어요. 다시 로그인한 뒤 시도해 주세요.";
  return error?.message || "탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export function deletedItems(summary, user) {
  const account = user?.email || (PROVIDER_NAMES[user?.provider] ? `${PROVIDER_NAMES[user.provider]} 계정` : "");
  return [
    account ? `계정과 로그인 정보 (${account})` : "계정과 로그인 정보",
    `체험 기록: 입학한 학과 ${summary.departments}곳, 성적이 남은 과목 ${summary.courses}개, 한 줄 기록 ${summary.notes}개`,
    summary.profile ? "프로필: 이름과 프로필 사진" : "프로필 (저장한 이름·사진 없음)",
  ];
}
