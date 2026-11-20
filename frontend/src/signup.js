import { openStorage } from "./storage.js";
const BLOCKED = "campushi-signup-age-blocked";
let blockedInMemory = false;
export function ageAllowed(year, serverYear) {
  return Number.isInteger(year) && year >= 1900 && year <= serverYear - 15;
}
export function signupBlocked() {
  const storage = openStorage(() => sessionStorage);
  try { return blockedInMemory || storage?.getItem(BLOCKED) === "1"; } catch { return blockedInMemory; }
}
export function blockSignup() {
  blockedInMemory = true;
  try { openStorage(() => sessionStorage)?.setItem(BLOCKED, "1"); } catch { /* 이 창의 메모리 표시도 함께 유지한다. */ }
}
export function signupBody(form, version) {
  return { birth_year: Number(form.year), role: form.role, terms_agreed: form.terms, privacy_agreed: form.privacy, marketing_agreed: form.marketing, policy_version: version };
}
