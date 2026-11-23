import { request } from "./api.js";

export const PROVIDER_NAMES = { google: "구글", kakao: "카카오", apple: "Apple", email: "이메일" };
export const RETURN_VIEWS = ["my", "home", "experience", "community"];
export function authReturn(search) {
  const params = new URLSearchParams(search);
  return { result: params.get("auth"), view: RETURN_VIEWS.includes(params.get("view")) ? params.get("view") : "my" };
}
// #95 이 기기에서 로그인한 적이 있는지. 세션 쿠키는 스크립트로 읽을 수 없으므로 로그인이 확인될 때 따로 표시해 둔다.
// 표시가 없고 로그인 복귀 주소도 아니면 /api/me 응답을 기다리지 않고 바로 체험을 시작한다.
export const SIGNED_IN_KEY = "campushi-signed-in-v1";
export function expectsAccount(storage, search) {
  if (authReturn(search).result) return true;
  try {
    return storage?.getItem(SIGNED_IN_KEY) === "1";
  } catch {
    return false;
  }
}
export function rememberSignIn(storage, signedIn) {
  try {
    if (signedIn) storage?.setItem(SIGNED_IN_KEY, "1");
    else storage?.removeItem(SIGNED_IN_KEY);
  } catch {
    // 표시를 남기지 못하면 다음 방문에 로그인 확인 전 잠깐 체험 화면이 보일 뿐이다.
  }
}
export function loginRequest(path, method = "GET", body) {
  return request(path, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, undefined, "계정 서버에 연결하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
}
