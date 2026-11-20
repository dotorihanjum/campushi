import { request } from "./api.js";

export const PROVIDER_NAMES = { google: "구글", kakao: "카카오", apple: "Apple", email: "이메일" };
export const RETURN_VIEWS = ["my", "home", "experience", "community"];
export function authReturn(search) {
  const params = new URLSearchParams(search);
  return { result: params.get("auth"), view: RETURN_VIEWS.includes(params.get("view")) ? params.get("view") : "my" };
}
export function loginRequest(path, method = "GET", body) {
  return request(path, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, undefined, "계정 서버에 연결하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
}
