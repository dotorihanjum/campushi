import test from "node:test";
import assert from "node:assert/strict";
import { CERTIFICATES, REVIEW, isReview, reviewableCertificates } from "./certificates.js";
import { readFileSync } from "node:fs";

// screens/index.js는 JSX 화면을 불러오므로 node 테스트에서는 파일 글자로 SCREENS 이름을 읽는다.
const SCREENS_NAMES = [...readFileSync(new URL("./screens/index.js", import.meta.url), "utf8").matchAll(/^\s+(\w+): \w+,$/gm)].map((m) => m[1]);

const screens = (list) => list.map((c) => c.screen);

test("입학하지 않은 학과는 다시 볼 증명서가 없다", () => {
  for (const journey of [undefined, null, false, "x", 0])
    assert.deepEqual(reviewableCertificates(journey, { graduated: true }), []);
});

test("입학만 한 학과는 입학증만 다시 본다(성적표·졸업증명서 진입점이 없다)", () => {
  assert.deepEqual(screens(reviewableCertificates({ enrolledAt: 1 }, { graduated: false })), ["enrolled"]);
  // 입학 시각을 남기기 전의 예전 기록({})도 입학한 학과다.
  assert.deepEqual(screens(reviewableCertificates({}, { graduated: false })), ["enrolled"]);
  // 진행 기록을 계산하지 못했거나 graduated가 참이 아니면 졸업으로 보지 않는다.
  for (const progress of [undefined, null, {}, { graduated: "true" }, { graduated: 1 }])
    assert.deepEqual(screens(reviewableCertificates({}, progress)), ["enrolled"]);
});

test("졸업한 학과는 입학증·성적표·졸업증명서를 이 순서로 다시 본다", () => {
  const list = reviewableCertificates({ enrolledAt: 1 }, { graduated: true });
  assert.deepEqual(screens(list), ["enrolled", "grades", "diploma"]);
  assert.deepEqual(list.map((c) => c.name), ["입학증", "성적표", "졸업증명서"]);
});

test("증명서는 모두 실제 화면 이름이다", () => {
  for (const c of CERTIFICATES) assert.ok(SCREENS_NAMES.includes(c.screen), c.screen);
});

test("다시 보기 params만 다시 보기로 본다(처음 입학·졸업 직후 흐름은 params가 없다)", () => {
  assert.equal(isReview(REVIEW), true);
  assert.equal(isReview({ review: true }), true);
  for (const params of [undefined, null, {}, { review: "true" }, { review: 1 }, { focus: "departments" }]) assert.equal(isReview(params), false);
});
