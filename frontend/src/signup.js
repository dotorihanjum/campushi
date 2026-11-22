import { openStorage } from "./storage.js";
const BLOCKED = "campushi-signup-age-blocked";
let blockedInMemory = false;
export function signupBlocked() {
  const storage = openStorage(() => sessionStorage);
  try { return blockedInMemory || storage?.getItem(BLOCKED) === "1"; } catch { return blockedInMemory; }
}
export function blockSignup() {
  blockedInMemory = true;
  try { openStorage(() => sessionStorage)?.setItem(BLOCKED, "1"); } catch { /* 이 창의 메모리 표시도 함께 유지한다. */ }
}
export function signupBody(form, version) {
  return { birth_year: Number(form.year), role: form.role, terms_agreed: form.terms, privacy_agreed: form.privacy, policy_version: version };
}

// 문서 버전이 바뀌면 이전 문서에 대한 체크를 새 동의로 취급하지 않는다.
export function refreshSignupConsent(form, version) {
  return form.version === version ? form : { ...form, version, terms: false, privacy: false };
}
