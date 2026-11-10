import test from "node:test";
import assert from "node:assert/strict";
import { CONDITIONS, LABS, isLabId, labOf } from "./index.js";
import { courseKey, completeCourse, departmentsOf, gameOf, initialState, normalize, progressOf, savePlay, labFor } from "../model.js";
import { isGame } from "../games.js";
import { RAW_CSE } from "../testFixtures.js";

const WEB = "웹/파이선프로그래밍";
const CALC = "미분적분학";
// 1학년 필수가 미분적분학(이론 퀴즈)과 웹/파이선프로그래밍(진짜 수업 체험)인 컴퓨터공학과.
const RAW = {
  ...RAW_CSE,
  years: { ...RAW_CSE.years, 1: ["이산구조", CALC, WEB] },
  kinds: { 전공기초: [CALC], 전공필수: [WEB, "자료구조", "컴퓨터구조", "알고리즘", "운영체제", "캡스톤디자인", "졸업프로젝트", "졸업논문"] },
  games: { [CALC]: "theory", [WEB]: "theory" },
};
const dept = (state) => departmentsOf(state).find((d) => d.id === RAW.id);
// 과목을 들어 성적을 받는다.
function take(state, subject, correct, total = 10) {
  const d = dept(state);
  return completeCourse(savePlay(state, RAW.id, subject, gameOf(d, subject), "결과", { correct, total }), RAW.id, subject, "해봤어요");
}
// 이 기능이 나오기 전에 저장된 기록(이수 조건 버전이 없다).
const savedBefore = (records) => ({
  ...structuredClone(initialState),
  conditions: undefined,
  exempt: undefined,
  catalog: [RAW],
  journeys: { [RAW.id]: {} },
  current: RAW.id,
  records,
});

test("등록부: 검증을 통과한 체험만 과목에 붙고, 체험이 있으면 연습 문제보다 먼저다", () => {
  const lab = LABS[RAW.id][WEB];
  assert.equal(lab.status, "verified");
  assert.equal(lab.since <= CONDITIONS, true);
  const state = normalize({ ...structuredClone(initialState), catalog: [RAW] });
  const d = dept(state);
  assert.equal(gameOf(d, WEB), "lab:python-functions");
  assert.equal(labFor(d, WEB), lab);
  assert.equal(gameOf(d, CALC), "theory");
  assert.equal(isLabId("lab:python-functions"), true);
  assert.equal(isGame("lab:python-functions"), true);
  // 내린 체험(자기소개 웹사이트)의 결과는 더는 체험 결과로 보지 않는다.
  assert.equal(isLabId("lab:web-python"), false);
  assert.equal(isLabId("lab:없는체험"), false);
  // 검토 전(draft)인 체험은 공개되지 않는다.
  lab.status = "draft";
  try {
    assert.equal(labOf(RAW.id, WEB), null);
    assert.equal(gameOf(d, WEB), "theory");
    assert.equal(isLabId("lab:python-functions"), false);
  } finally {
    lab.status = "verified";
  }
});

test("신규 사용자: 새 체험이 있는 필수과목도 이수해야 다음 학년이 열린다", () => {
  let state = normalize({ ...structuredClone(initialState), catalog: [RAW], journeys: { [RAW.id]: {} } });
  assert.equal(state.conditions, CONDITIONS);
  assert.deepEqual(state.exempt, {});
  state = take(state, CALC, 10);
  assert.equal(progressOf(state, dept(state)).years[1].open, false);
  assert.deepEqual(progressOf(state, dept(state)).years[0].left.map((c) => c.subject), [WEB]);
  state = take(state, WEB, 9);
  assert.equal(progressOf(state, dept(state)).years[1].open, true);
});

test("기존 사용자: 이미 2학년이 열렸으면 다시 잠그지 않고, 새 체험이 추가됐다고 알린다", () => {
  const key = courseKey(RAW.id, CALC);
  let state = normalize(savedBefore({ [key]: { grade: "A0", percent: 90, attempts: 1 } }));
  assert.equal(state.conditions, CONDITIONS);
  assert.deepEqual(state.exempt, { [courseKey(RAW.id, WEB)]: true });
  let progress = progressOf(state, dept(state));
  assert.equal(progress.years[1].open, true);
  const web = progress.years[0].courses.find((c) => c.subject === WEB);
  assert.equal(web.added, true);
  assert.equal(web.planned, false);
  // 다시 저장했다 불러와도(새 학과 데이터를 받아도) 예외는 그대로이고, 다시 계산하지 않는다.
  state = normalize(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(state.exempt, { [courseKey(RAW.id, WEB)]: true });
  // 새 체험을 들어 볼 수 있고, 이수하면 더는 "추가됨"으로 알리지 않는다.
  state = take(state, WEB, 3);
  progress = progressOf(state, dept(state));
  assert.equal(progress.years[1].open, true);
  assert.equal(progress.years[0].courses.find((c) => c.subject === WEB).added, false);
});

test("이수 중인 사용자: 아직 2학년이 열리지 않았으면 새 조건을 따른다", () => {
  // 예전 기준으로 미분적분학을 C+로 받고 기록은 남기지 않아 이수하지 못한 상태.
  const key = courseKey(RAW.id, CALC);
  let state = normalize(savedBefore({ [key]: { grade: "C+", percent: 65, attempts: 1 } }));
  assert.deepEqual(state.exempt, {});
  state = take(state, CALC, 10);
  assert.equal(progressOf(state, dept(state)).years[1].open, false);
  state = take(state, WEB, 10);
  assert.equal(progressOf(state, dept(state)).years[1].open, true);
  // 아무것도 듣지 않은 기존 사용자도 마찬가지다.
  assert.deepEqual(normalize(savedBefore({})).exempt, {});
});

test("이미 지금 조건으로 저장된 기록은 다시 계산하지 않고, 맞지 않는 예외는 버린다", () => {
  const raw = {
    ...structuredClone(initialState),
    catalog: [RAW],
    journeys: { [RAW.id]: {} },
    records: { [courseKey(RAW.id, CALC)]: { grade: "A+", percent: 100, attempts: 1 } },
    conditions: CONDITIONS,
    exempt: { [courseKey(RAW.id, "이산구조")]: true, [courseKey(RAW.id, "없는과목")]: true, [courseKey(RAW.id, WEB)]: "yes" },
  };
  const state = normalize(raw);
  // 이산구조는 이 데이터에서 체험이 없는(구현 예정) 과목이라 예외가 될 수 없다.
  assert.deepEqual(state.exempt, {});
  assert.equal(progressOf(state, dept(state)).years[1].open, false);
});
