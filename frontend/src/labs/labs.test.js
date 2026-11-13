import test from "node:test";
import assert from "node:assert/strict";
import { CONDITIONS, LABS, RESTORED, addedSince, isLabId, labOf } from "./index.js";
import { courseKey, completeCourse, departmentsOf, gameOf, initialState, isPlanned, normalize, progressOf, savePlay } from "../model.js";
import { isGame } from "../games.js";
import { RAW_CSE } from "../testFixtures.js";

const WEB = "웹/파이선프로그래밍";
const DS = "자료구조";
const CALC = "미분적분학";
const ARCH = "컴퓨터구조";
// 1학년 필수가 미분적분학(이론 퀴즈)과 웹/파이선프로그래밍(체험 없음), 2학년 필수가 컴퓨터구조(이론 퀴즈)와 자료구조(체험 없음)인 컴퓨터공학과.
const RAW = {
  ...RAW_CSE,
  years: { ...RAW_CSE.years, 1: ["이산구조", CALC, WEB], 2: [DS, ARCH, "논리회로"] },
  kinds: { 전공기초: [CALC], 전공필수: [WEB, DS, ARCH, "알고리즘", "운영체제", "캡스톤디자인", "졸업프로젝트", "졸업논문"] },
  games: { [CALC]: "theory", [ARCH]: "theory" },
};
const dept = (state) => departmentsOf(state).find((d) => d.id === RAW.id);
// 과목을 들어 정답률로 성적을 받는다(기본 10문항 중 9개 = A0, 이수).
function take(state, subject, correct = 9) {
  const d = dept(state);
  return completeCourse(savePlay(state, RAW.id, subject, gameOf(d, subject), "결과", { correct, total: 10 }), RAW.id, subject);
}
// 이론 퀴즈를 내렸던 동안(이수 조건 버전 2) 저장된 기록.
const savedAt = (conditions, records = {}) => ({
  ...structuredClone(initialState),
  conditions,
  exempt: undefined,
  catalog: [RAW],
  journeys: { [RAW.id]: {} },
  current: RAW.id,
  records,
});

test("등록부: 웹/파이선·자료구조 체험은 빠졌고, 그 결과는 체험 결과로 보지 않는다", () => {
  assert.deepEqual(LABS, {});
  const d = dept(normalize({ ...structuredClone(initialState), catalog: [RAW] }));
  assert.equal(labOf(RAW.id, WEB), null);
  assert.equal(labOf(RAW.id, DS), null);
  // 이론 퀴즈도 없으니 구현 예정이다.
  assert.equal(isPlanned(d, WEB), true);
  assert.equal(isPlanned(d, DS), true);
  assert.equal(gameOf(d, CALC), "theory");
  for (const id of ["lab:python-functions", "lab:stack-queue", "lab:web-python"]) {
    assert.equal(isLabId(id), false);
    assert.equal(isGame(id), false);
  }
});

test("다시 공개한 이론 퀴즈 15과목은 지금 이수 조건 버전으로 등록돼 있다", () => {
  assert.equal(CONDITIONS, 3);
  assert.equal(Object.keys(RESTORED[RAW.id]).length, 15);
  assert.ok(Object.values(RESTORED[RAW.id]).every((since) => since === CONDITIONS));
  assert.deepEqual(addedSince(RAW.id, CONDITIONS), []);
  assert.ok(addedSince(RAW.id, 2).includes(CALC));
  assert.deepEqual(addedSince("khu-id", 0), []);
});

test("신규 사용자: 이론 퀴즈가 있는 필수과목을 이수해야 다음 학년이 열린다", () => {
  let state = normalize({ ...structuredClone(initialState), catalog: [RAW], journeys: { [RAW.id]: {} } });
  assert.equal(state.conditions, CONDITIONS);
  assert.deepEqual(state.exempt, {});
  // 체험이 없는 웹/파이선은 조건에서 빠지고 미분적분학만 남는다.
  assert.deepEqual(progressOf(state, dept(state)).years[0].left.map((c) => c.subject), [CALC]);
  assert.equal(progressOf(state, dept(state)).years[1].open, false);
  state = take(state, CALC);
  assert.equal(progressOf(state, dept(state)).years[1].open, true);
  assert.equal(progressOf(state, dept(state)).years[2].open, false);
  state = take(state, ARCH);
  assert.equal(progressOf(state, dept(state)).years[2].open, true);
});

test("이론 퀴즈를 내렸던 동안 학년이 열린 사용자는 다시 잠그지 않고, 새 체험이 생겼다고 알린다", () => {
  // 버전 2에서는 1·2학년 필수 체험(웹/파이선·자료구조)만 조건이었다. 둘 다 빠졌으니 그 조건으로는 3학년까지 열려 있다.
  let state = normalize(savedAt(2));
  assert.equal(state.conditions, CONDITIONS);
  assert.deepEqual(state.exempt, { [courseKey(RAW.id, CALC)]: true, [courseKey(RAW.id, ARCH)]: true });
  let progress = progressOf(state, dept(state));
  assert.equal(progress.years[2].open, true);
  assert.equal(progress.years[0].courses.find((c) => c.subject === CALC).added, true);
  // 다시 저장했다 불러와도 예외는 그대로다.
  state = normalize(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(state.exempt, { [courseKey(RAW.id, CALC)]: true, [courseKey(RAW.id, ARCH)]: true });
  // 다시 생긴 퀴즈를 들어 볼 수 있고, 이수하면 더는 "추가됨"으로 알리지 않는다.
  state = take(state, CALC);
  progress = progressOf(state, dept(state));
  assert.equal(progress.years[2].open, true);
  assert.equal(progress.years[0].courses.find((c) => c.subject === CALC).added, false);
});

test("입학하지 않은 학과와 이미 지금 조건으로 저장된 기록은 예외를 만들지 않는다", () => {
  assert.deepEqual(normalize({ ...savedAt(2), journeys: {} }).exempt, {});
  const state = normalize({
    ...savedAt(CONDITIONS),
    exempt: { [courseKey(RAW.id, "이산구조")]: true, [courseKey(RAW.id, WEB)]: true, [courseKey(RAW.id, CALC)]: "yes" },
  });
  // 이산구조는 이 데이터에서 퀴즈가 없고, 웹/파이선은 체험이 빠져 예외가 될 수 없다.
  assert.deepEqual(state.exempt, {});
  assert.equal(progressOf(state, dept(state)).years[1].open, false);
});

test("체험이 빠진 과목(웹/파이선)의 지난 성적은 저장해 두지만 과목 목록·이수 수에는 보이지 않는다", () => {
  const key = courseKey(RAW.id, WEB);
  const state = normalize({ ...savedAt(CONDITIONS, { [key]: { grade: "P", percent: null, attempts: 1, last: "P" } }), notes: { [key]: "기록" } });
  assert.equal(state.records[key].grade, "P");
  const progress = progressOf(state, dept(state));
  const web = progress.years[0].courses.find((c) => c.subject === WEB);
  assert.equal(web.planned, true);
  assert.equal(web.record, null);
  assert.equal(web.passed, false);
  assert.equal(progress.taken.length, 0);
});

test("이론 퀴즈는 정답률로 성적을 받고, B- 미만이면 다음 학년이 열리지 않는다. 기록은 없어도 된다", () => {
  let state = normalize({ ...structuredClone(initialState), catalog: [RAW], journeys: { [RAW.id]: {} } });
  state = take(state, CALC, 5);
  assert.equal(state.records[courseKey(RAW.id, CALC)].grade, "D+");
  assert.equal(progressOf(state, dept(state)).years[1].open, false);
  state = take(state, CALC, 8);
  assert.equal(state.records[courseKey(RAW.id, CALC)].grade, "B+");
  assert.equal(state.notes[courseKey(RAW.id, CALC)], undefined);
  assert.equal(progressOf(state, dept(state)).years[1].open, true);
});
