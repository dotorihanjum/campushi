import test from "node:test";
import assert from "node:assert/strict";
import { CREDIT_FORFEIT, deletedItems, withdrawFailure } from "./withdraw.js";

test("credit forfeiture sentence matches the acceptance criteria exactly", () => {
  assert.equal(CREDIT_FORFEIT, "탈퇴하면 크레딧은 소멸하고 되살리거나 환불하지 않아요.");
});
test("deleted items list the account, counts and profile from the server summary", () => {
  const summary = { credits: 5, departments: 2, courses: 3, passed: 2, notes: 1, profile: true };
  assert.deepEqual(deletedItems(summary, { email: "a@example.com", provider: "email" }), [
    "계정과 로그인 정보 (a@example.com)",
    "체험 기록: 입학한 학과 2곳, 성적이 남은 과목 3개, 한 줄 기록 1개",
    "프로필: 이름과 프로필 사진",
  ]);
  assert.equal(deletedItems({ ...summary, profile: false }, { email: null, provider: "kakao" })[0], "계정과 로그인 정보 (카카오 계정)");
  assert.equal(deletedItems({ ...summary, profile: false }, null)[2], "프로필 (저장한 이름·사진 없음)");
});
test("failures never claim the account was deleted and tell the next step", () => {
  assert.match(withdrawFailure({ status: 0, message: "x" }), /인터넷 연결을 확인/);
  assert.match(withdrawFailure({ status: 401, message: "x" }), /다시 로그인/);
  assert.equal(withdrawFailure({ status: 503, message: "계정 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." }), "계정 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
  for (const status of [0, 401, 403, 503]) assert.doesNotMatch(withdrawFailure({ status, message: "m" }), /탈퇴했어요|탈퇴를 마쳤어요/);
});
