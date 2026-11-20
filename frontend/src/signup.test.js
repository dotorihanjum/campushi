import test from "node:test";
import assert from "node:assert/strict";
import { ageAllowed, signupBody, signupBlocked, blockSignup, refreshSignupConsent } from "./signup.js";

test("출생연도로 만 나이를 보수적으로 판정하며 경계 연도는 거부한다", () => {
  assert.equal(ageAllowed(2012, 2026), false);
  assert.equal(ageAllowed(2011, 2026), true);
  assert.equal(ageAllowed(2027, 2026), false);
  assert.equal(ageAllowed(1899, 2026), false);
  assert.equal(ageAllowed("2011", 2026), false);
});
test("가입 요청은 연도·역할·동의만 보내고 사용자 ID를 받지 않는다", () => {
  assert.deepEqual(signupBody({ year: "2011", role: "student", terms: true, privacy: true, marketing: false, user_id: "other" }, "v1"), { birth_year: 2011, role: "student", terms_agreed: true, privacy_agreed: true, marketing_agreed: false, policy_version: "v1" });
});
test("같은 창에서 출생연도를 바꿔도 가입 제한을 유지하며 저장소 차단에도 작동한다", () => {
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("blocked"); } });
  assert.equal(signupBlocked(), false);
  blockSignup(); assert.equal(signupBlocked(), true);
});

test("약관 버전이 바뀌면 나이·역할은 보존하고 필수·선택 동의를 다시 받는다", () => {
  const old = { year: "2011", role: "mentor", terms: true, privacy: true, marketing: true, version: "v1" };
  assert.equal(refreshSignupConsent(old, "v1"), old);
  assert.deepEqual(refreshSignupConsent(old, "v2"), { ...old, version: "v2", terms: false, privacy: false, marketing: false });
  assert.equal(signupBody(old, old.version).policy_version, "v1");
});
