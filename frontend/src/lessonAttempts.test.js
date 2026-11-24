import test from "node:test";
import assert from "node:assert/strict";
import { createLessonAttempts } from "./lessonAttempts.js";

const KEY = "khu-cse|미분적분학";

test("#97 체험한 뒤 수업을 나갔다 다시 들어오면 앞의 시도를 이어 쓴다(새 시도로 20초가 다시 시작되지 않는다)", () => {
  const attempts = createLessonAttempts();
  // 처음 연다: 새 시도를 시작하고 서버가 번호를 준다.
  const n = attempts.open(KEY, { played: false, now: 1000 });
  assert.equal(typeof n, "number");
  attempts.fill(KEY, n, "attempt-1");
  // 66초 풀고 기록 단계에서 뒤로 나갔다가 다시 들어온다(화면이 새로 마운트된다). 체험 결과(plays)가 있으니 이어 쓴다.
  assert.equal(attempts.open(KEY, { played: true, now: 70000 }), null);
  // 8.6초 뒤 성적 받기: 처음 연 시각의 시도를 쓴다.
  assert.deepEqual(attempts.take(KEY), { id: "attempt-1", at: 1000, n });
  // 한 번 쓰면 지운다.
  assert.deepEqual(attempts.take(KEY), { id: null, at: 0, n: 0 });
});

test("#97 체험하지 않은 채 다시 열거나 다시 듣기를 누르면 새 시도를 받고, 늦게 온 이전 응답은 버린다", () => {
  const attempts = createLessonAttempts();
  const first = attempts.open(KEY, { played: false, now: 1000 });
  // 체험 결과 없이 다시 들어오면 수업을 처음부터 하므로 새 시도다.
  const second = attempts.open(KEY, { played: false, now: 5000 });
  assert.notEqual(first, second);
  attempts.fill(KEY, first, "late");
  assert.equal(attempts.take(KEY).id, null);
  // 다시 듣기(begin)도 새 시도이고, 그 응답만 남는다.
  const third = attempts.begin(KEY, 9000);
  attempts.fill(KEY, third, "attempt-3");
  assert.deepEqual(attempts.take(KEY), { id: "attempt-3", at: 9000, n: third });
  // 체험 결과가 있어도 보관한 시도가 없으면(이미 썼거나 새로고침) 새 시도를 받는다.
  assert.equal(typeof attempts.open(KEY, { played: true, now: 12000 }), "number");
  // 다른 과목 시도와 섞이지 않는다.
  attempts.fill("khu-cse|선형대수", 99, "other");
  assert.equal(attempts.take("khu-cse|선형대수").id, null);
});
