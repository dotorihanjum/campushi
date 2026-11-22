import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cleanNickname,
  NICKNAME_MAX,
  CREDIT_COOLDOWN_DAYS,
  CREDIT_PER_PASS,
  creditWaitDays,
  OLD_STORAGE_KEYS,
  STORAGE_KEY,
  completeCourse,
  courseKey,
  createDepartment,
  departmentsOf,
  enroll,
  gameOf,
  initialState,
  isPlanned,
  isRequired,
  kindOf,
  leaveDepartment,
  loadState,
  nextStepOf,
  normalize,
  progressOf,
  recordOf,
  refreshCatalog,
  savePlay,
  serverCreditOf,
  skippedYears,
  sourceNote,
  yearOf,
  yearSubjects,
} from "./model.js";
import { RAW_CSE, RAW_ID } from "./testFixtures.js";

const enrolled = (raws = [RAW_CSE], ids = [RAW_CSE.id]) => ({
  ...structuredClone(initialState),
  catalog: raws,
  journeys: Object.fromEntries(ids.map((id) => [id, {}])),
  current: ids[0],
});
// 과목을 들어 성적을 받는다(맞힌 수 / 전체).
function take(state, id, subject, correct, total = 10, now = Date.now()) {
  const d = departmentsOf(state).find((item) => item.id === id);
  const score = correct === "P" ? "P" : { correct, total };
  return completeCourse(savePlay(state, id, subject, gameOf(d, subject), "결과", score), id, subject, "", now);
}
const DAY = 24 * 60 * 60 * 1000;
const progress = (state, id = RAW_CSE.id) => progressOf(state, departmentsOf(state).find((d) => d.id === id));

test("실제 학과 데이터(서버 파일)는 프런트 형식 검사를 통과하고, 필수과목은 편성표의 이수구분이다", () => {
  const { departments } = JSON.parse(readFileSync(new URL("../../backend/data/departments.json", import.meta.url), "utf8"));
  const [cse, id] = departments.map(createDepartment);
  assert.ok(cse && id);
  const required = (d, year) => d.years[year].filter((subject) => isRequired(d, subject)).sort();
  assert.deepEqual(required(cse, 1), ["객체지향프로그래밍", "미분방정식", "미분적분학", "선형대수", "웹/파이선프로그래밍"]);
  assert.deepEqual(required(cse, 4), ["졸업논문", "졸업프로젝트", "캡스톤디자인"]);
  assert.equal(kindOf(cse, "미분적분학"), "전공기초");
  assert.equal(kindOf(cse, "이산구조"), "전공선택");
  assert.equal(required(id, 1).length, 7);
  assert.equal(cse.final.template, "G");
  assert.equal(id.final.kind, "artwork");
  assert.ok(cse.practiceSubject && cse.practice);
  assert.equal(id.practice, null);
});

test("형식이 틀린 학과 데이터는 쓰지 않는다", () => {
  assert.equal(createDepartment(null), null);
  assert.equal(createDepartment({ ...RAW_CSE, group: "music" }), null);
  assert.equal(createDepartment({ ...RAW_CSE, id: "" }), null);
  assert.equal(createDepartment({ ...RAW_CSE, id: "a|b" }), null);
  assert.equal(createDepartment({ ...RAW_CSE, years: { ...RAW_CSE.years, 2: [] } }), null);
  assert.equal(createDepartment({ ...RAW_CSE, final: "이산구조" }), null);
  // 편성표에 없는 과목의 이수구분은 버린다.
  assert.equal(kindOf(createDepartment({ ...RAW_CSE, kinds: { 전공필수: ["없는과목"] } }), "없는과목"), "전공선택");
});

test("실제 학과 데이터의 출처 줄에는 교육과정 연도와 확인일이 보인다", () => {
  const { departments } = JSON.parse(readFileSync(new URL("../../backend/data/departments.json", import.meta.url), "utf8"));
  const [cse, id] = departments.map(createDepartment);
  assert.equal(sourceNote(cse.source), "2026년 교육과정 · 2026-11-03 확인");
  assert.equal(sourceNote(id.source), "2025년 교육과정 · 2026-11-03 확인");
});

test("출처 확인일이 없거나 형식이 틀려도 학과는 열리고 확인일만 빠진다", () => {
  const withSource = (source) => createDepartment({ ...RAW_CSE, source: { ...RAW_CSE.source, ...source } });
  const { checked_at, ...noChecked } = RAW_CSE.source;
  const missing = createDepartment({ ...RAW_CSE, source: noChecked });
  assert.ok(missing);
  assert.equal(missing.source.checkedAt, null);
  assert.equal(sourceNote(missing.source), "2026년 교육과정");
  for (const bad of ["2026/11/03", "2026-13-01", "2026-02-30", "26-11-03", "2026-11-03T09:00:00", "", 20261103, null, {}]) {
    const d = withSource({ checked_at: bad });
    assert.ok(d, `학과가 열려야 해요: ${JSON.stringify(bad)}`);
    assert.equal(d.source.checkedAt, null, JSON.stringify(bad));
    assert.equal(sourceNote(d.source), "2026년 교육과정");
  }
  assert.equal(withSource({ checked_at: "2024-02-29" }).source.checkedAt, "2024-02-29");
  // 확인일만 있으면 확인일만, 둘 다 없으면 빈 줄(문서 이름만 보인다).
  assert.equal(sourceNote(withSource({ curriculum_year: undefined }).source), "2026-11-03 확인");
  assert.equal(sourceNote(withSource({ curriculum_year: "2026", checked_at: undefined }).source), "");
});

test("과목마다 이수구분·학년·체험(졸업 과제, 전공 실습, 연습 문제, 구현 예정)이 정해진다", () => {
  const d = createDepartment(RAW_CSE);
  assert.equal(gameOf(d, "졸업프로젝트"), "final");
  assert.equal(gameOf(d, "알고리즘"), "group:computing");
  assert.equal(gameOf(d, "미분적분학"), "theory");
  assert.equal(gameOf(d, "객체지향프로그래밍"), "match");
  assert.ok(isPlanned(d, "이산구조") && isPlanned(d, "오픈소스SW개발방법및도구"));
  assert.ok(!isPlanned(d, "졸업프로젝트"));
  assert.equal(yearOf(d, "운영체제"), 3);
  assert.equal(yearOf(d, "없는과목"), null);
  assert.ok(isRequired(d, "오픈소스SW개발방법및도구") && !isRequired(d, "이산구조"));
  assert.deepEqual(yearSubjects(d)[0], { year: 1, open: ["객체지향프로그래밍", "미분적분학"], others: ["이산구조"] });
});

test("1학년은 처음부터 열리고, 체험이 있는 필수과목을 모두 B- 이상 받으면 다음 학년이 열린다", () => {
  let state = enrolled();
  let p = progress(state);
  assert.deepEqual(p.years.map((y) => y.open), [true, false, false, false]);
  assert.deepEqual(p.years[0].left.map((c) => c.subject), ["객체지향프로그래밍", "미분적분학"]);
  assert.equal(p.openYear, 1);
  // 선택과목은 들어도 해금과 상관없다(이산구조는 구현 예정이라 들을 수도 없다).
  assert.equal(take(state, RAW_CSE.id, "이산구조", 10), state);
  state = take(state, RAW_CSE.id, "객체지향프로그래밍", 7); // 70% B-
  assert.equal(recordOf(state, RAW_CSE.id, "객체지향프로그래밍").grade, "B-");
  assert.equal(progress(state).openYear, 1);
  state = take(state, RAW_CSE.id, "미분적분학", 9); // 90% A0
  p = progress(state);
  // 2학년 필수(오픈소스SW개발방법및도구·컴퓨터구조)는 체험이 없어 조건에서 빠지므로 3학년까지 바로 열린다.
  assert.deepEqual(p.years.map((y) => y.open), [true, true, true, false]);
  assert.deepEqual(p.years[1].left, []);
  assert.deepEqual(p.years[2].left.map((c) => c.subject), ["알고리즘", "운영체제"]);
  assert.equal(p.passedCount, 2);
});

test("다음 학년 해금까지의 진행은 지금 학년 필수과목(체험이 있는 것) 중 이수한 비율이고, 4학년은 졸업 과제를 넣어 졸업까지다", () => {
  let state = enrolled();
  assert.deepEqual(nextStepOf(progress(state)), { target: 2, done: 0, total: 2, percent: 0 });
  state = take(state, RAW_CSE.id, "미분적분학", 8);
  assert.deepEqual(nextStepOf(progress(state)), { target: 2, done: 1, total: 2, percent: 50 });
  // 1학년을 마치면 2학년(필수 체험 없음)과 함께 3학년이 열려 4학년 해금까지를 센다.
  state = take(state, RAW_CSE.id, "객체지향프로그래밍", 8);
  assert.deepEqual(nextStepOf(progress(state)), { target: 4, done: 0, total: 2, percent: 0 });
  for (const subject of ["알고리즘", "운영체제"]) state = take(state, RAW_CSE.id, subject, 9);
  // 4학년: 체험이 있는 필수(졸업프로젝트)이자 졸업 과제 하나.
  assert.deepEqual(nextStepOf(progress(state)), { target: null, done: 0, total: 1, percent: 0 });
  state = take(state, RAW_CSE.id, "졸업프로젝트", 9);
  assert.equal(nextStepOf(progress(state)).percent, 100);
});

test("C+ 이하는 재수강해야 하고, 재수강하면 가장 좋은 성적이 남는다", () => {
  let state = enrolled();
  state = take(state, RAW_CSE.id, "미분적분학", 10);
  state = take(state, RAW_CSE.id, "객체지향프로그래밍", 6); // 60% C0
  let p = progress(state);
  assert.equal(p.openYear, 1);
  assert.deepEqual(p.years[0].left.map((c) => c.subject), ["객체지향프로그래밍"]);
  assert.equal(p.years[0].courses.find((c) => c.subject === "객체지향프로그래밍").passed, false);
  state = take(state, RAW_CSE.id, "객체지향프로그래밍", 8); // 80% B+
  state = take(state, RAW_CSE.id, "객체지향프로그래밍", 5); // 50% D+ — 더 낮으면 B+가 남는다
  const record = recordOf(state, RAW_CSE.id, "객체지향프로그래밍");
  assert.deepEqual(record, { grade: "B+", percent: 80, attempts: 3, last: "D+" });
  assert.equal(progress(state).openYear, 3);
  // 같은 등급이면 정답률이 더 높은 쪽을 남긴다.
  state = take(state, RAW_CSE.id, "미분적분학", 19, 20);
  assert.deepEqual(recordOf(state, RAW_CSE.id, "미분적분학"), { grade: "A+", percent: 100, attempts: 2, last: "A+" });
});

test("성적은 입학한 학과의 열린 학년 과목을, 그 체험을 끝까지 해봐야 받는다", () => {
  const state = enrolled();
  const key = courseKey(RAW_CSE.id, "객체지향프로그래밍");
  // 입학하지 않았거나, 체험을 하지 않았거나, 다른 체험의 결과면 그대로다.
  const notEnrolled = savePlay({ ...state, journeys: {} }, RAW_CSE.id, "객체지향프로그래밍", "match", "", { correct: 1, total: 1 });
  assert.equal(completeCourse(notEnrolled, RAW_CSE.id, "객체지향프로그래밍"), notEnrolled);
  assert.equal(completeCourse(state, RAW_CSE.id, "객체지향프로그래밍"), state);
  const other = { ...state, plays: { [key]: { game: "sort", summary: "", score: { correct: 1, total: 1 } } } };
  assert.equal(completeCourse(other, RAW_CSE.id, "객체지향프로그래밍"), other);
  // 아직 열리지 않은 학년의 과목은 들을 수 없다.
  assert.deepEqual(take(state, RAW_CSE.id, "운영체제", 10), savePlay(state, RAW_CSE.id, "운영체제", "sort", "결과", { correct: 10, total: 10 }));
  // 결과 형식이 맞지 않으면 남기지 않는다.
  assert.equal(savePlay(state, RAW_CSE.id, "객체지향프로그래밍", "match", "", { correct: 3, total: 2 }), state);
  assert.equal(savePlay(state, RAW_CSE.id, "객체지향프로그래밍", "없는게임", "", { correct: 1, total: 2 }), state);
  // 마치면 체험 결과와 쓰던 기록은 지우고, 적은 기록은 남긴다.
  const played = savePlay({ ...state, drafts: { [key]: "쓰던 글" } }, RAW_CSE.id, "객체지향프로그래밍", "match", "결과", { correct: 9, total: 10 });
  const done = completeCourse(played, RAW_CSE.id, "객체지향프로그래밍", "  재밌었다 ");
  assert.deepEqual(done.plays, {});
  assert.deepEqual(done.drafts, {});
  assert.equal(done.notes[key], "재밌었다");
});

test("4학년 필수(체험이 있는 것)와 졸업 과제를 이수하면 졸업한다. 작품 졸업 과제는 끝까지 하면 P다", () => {
  let state = enrolled();
  for (const [subject, n] of [["객체지향프로그래밍", 10], ["미분적분학", 10], ["알고리즘", 10], ["운영체제", 10]]) state = take(state, RAW_CSE.id, subject, n);
  let p = progress(state);
  assert.equal(p.openYear, 4);
  assert.equal(p.graduated, false);
  state = take(state, RAW_CSE.id, "졸업프로젝트", 5); // 50% — 졸업 과제도 B- 이상이어야 한다
  assert.equal(progress(state).graduated, false);
  state = take(state, RAW_CSE.id, "졸업프로젝트", 8);
  p = progress(state);
  assert.equal(p.graduated, true);
  assert.equal(p.percent, 100);

  // 산업디자인학과: 체험이 있는 필수는 드로잉뿐이고, 졸업 과제(도색)는 P다.
  let design = enrolled([RAW_ID], [RAW_ID.id]);
  assert.deepEqual(progress(design, RAW_ID.id).years.map((y) => y.open), [true, false, false, false]);
  design = take(design, RAW_ID.id, "드로잉", 10);
  assert.equal(progress(design, RAW_ID.id).openYear, 4);
  design = take(design, RAW_ID.id, "산업디자인종합설계2", "P");
  assert.equal(recordOf(design, RAW_ID.id, "산업디자인종합설계2").grade, "P");
  assert.equal(progress(design, RAW_ID.id).graduated, true);
});

test("입학하면 입학 시각을 남기고, 이미 입학한 학과는 다시 입학해도 입학 시각을 덮어쓰지 않는다", () => {
  const t0 = Date.UTC(2026, 10, 17, 3);
  const fresh = { ...structuredClone(initialState), catalog: [RAW_CSE, RAW_ID] };
  const state = enroll(fresh, RAW_CSE.id, t0);
  assert.deepEqual(state.journeys, { [RAW_CSE.id]: { enrolledAt: t0 } });
  assert.equal(enroll(state, RAW_CSE.id, t0 + DAY), state);
  // 다른 학과는 따로 입학하고, 저장했다가 다시 불러와도(다음 날) 입학 시각이 그대로 남는다.
  const both = enroll(state, RAW_ID.id, t0 + DAY);
  const restored = normalize(JSON.parse(JSON.stringify(both)));
  assert.deepEqual(restored.journeys, { [RAW_CSE.id]: { enrolledAt: t0 }, [RAW_ID.id]: { enrolledAt: t0 + DAY } });
  // 입학 시각이 없는 이전 형식 기록에 다시 입학해도 지금 시각으로 채우지 않는다(입학 기록이 이미 있다).
  const old = normalize({ ...fresh, journeys: { [RAW_CSE.id]: {} } });
  assert.equal(enroll(old, RAW_CSE.id, t0), old);
});

test("입학 시각이 없거나 잘못된 기록도 입학 기록은 지우지 않고, 잘못된 입학 시각만 버린다", () => {
  const t0 = Date.UTC(2026, 10, 17, 3);
  const base = take(enrolled(), RAW_CSE.id, "객체지향프로그래밍", 9);
  const key = courseKey(RAW_CSE.id, "객체지향프로그래밍");
  // 입학 시각을 남기기 전의 형식 {}: 오류 없이 열리고 입학 기록과 성적이 그대로 남는다.
  const old = normalize(JSON.parse(JSON.stringify({ ...base, journeys: { [RAW_CSE.id]: {} } })));
  assert.deepEqual(old.journeys, { [RAW_CSE.id]: {} });
  assert.ok(old.records[key]);
  assert.equal(old.current, RAW_CSE.id);
  // 잘못된 입학 시각(문자열, 날짜로 읽히지 않는 수, 0·음수, 객체, null)과 다른 필드는 버리고 입학 기록은 남긴다.
  for (const bad of ["2026-11-17T03:00:00.000Z", "abc", NaN, Infinity, 0, -1, 8.64e15 + 1, {}, null, true]) {
    const restored = normalize({ ...base, journeys: { [RAW_CSE.id]: { enrolledAt: bad, extra: 1 } } });
    assert.deepEqual(restored.journeys, { [RAW_CSE.id]: {} }, String(bad));
    assert.ok(restored.records[key], String(bad));
  }
  // 입학 기록 자체가 객체가 아니어도 입학한 학과로 남긴다.
  for (const raw of [null, "x", 1, true]) assert.deepEqual(normalize({ ...base, journeys: { [RAW_CSE.id]: raw } }).journeys, { [RAW_CSE.id]: {} });
  // 올바른 입학 시각만 남기고 다른 필드는 버린다. 학과 데이터에 없는 학과는 입학 시각이 있어도 지운다.
  const kept = normalize({ ...base, journeys: { [RAW_CSE.id]: { enrolledAt: t0, extra: 1 }, 없는학과: { enrolledAt: t0 } } });
  assert.deepEqual(kept.journeys, { [RAW_CSE.id]: { enrolledAt: t0 } });
});

test("저장된 기록은 지금 형식에 맞는 것만 불러오고, 이전 학기제 기록은 지운다", () => {
  let state = take(enrolled(), RAW_CSE.id, "객체지향프로그래밍", 9);
  const key = courseKey(RAW_CSE.id, "객체지향프로그래밍");
  const saved = {
    ...state,
    records: {
      ...state.records,
      [courseKey(RAW_CSE.id, "없는과목")]: { grade: "A+" },
      [courseKey(RAW_CSE.id, "미분적분학")]: { grade: "Z" },
      "없는학과|드로잉": { grade: "A+" },
    },
    plays: { [courseKey(RAW_CSE.id, "운영체제")]: { game: "match", summary: "", score: { correct: 1, total: 1 } } },
    notes: { [key]: "기록", 이상한키: "x" },
  };
  const store = (items) => {
    const data = { ...items };
    return { getItem: (name) => data[name] ?? null, removeItem: (name) => delete data[name], data };
  };
  const restored = loadState(store({ [STORAGE_KEY]: JSON.stringify(saved) }));
  assert.deepEqual(Object.keys(restored.records), [key]);
  assert.deepEqual(restored.plays, {});
  assert.deepEqual(restored.notes, { [key]: "기록" });
  // 이전 형식(campushi-v1)은 지우고 처음부터 시작하되, 시작 화면을 지나왔는지는 이어 받는다.
  const old = store({ [OLD_STORAGE_KEYS[0]]: JSON.stringify({ onboarded: true, journeys: { "khu-cse": { completed: 3 } } }) });
  const fresh = loadState(old);
  assert.equal(fresh.onboarded, true);
  assert.deepEqual(fresh.journeys, {});
  assert.equal(old.data[OLD_STORAGE_KEYS[0]], undefined);
  assert.deepEqual(loadState(store({ [STORAGE_KEY]: "{깨진" })), initialState);
});

test("서버에서 새 학과 데이터를 받으면 바꾸고, 쓸 수 없는 데이터면 저장해 둔 것을 쓴다", () => {
  const state = take(enrolled([RAW_CSE, RAW_ID], [RAW_CSE.id, RAW_ID.id]), RAW_ID.id, "드로잉", 9);
  assert.equal(refreshCatalog(state, []), state);
  assert.equal(refreshCatalog(state, [{ id: "x" }]), state);
  // 학과가 빠지면 그 학과의 기록도 정리하고, 편성이 바뀌어 없어진 과목의 성적은 지운다.
  const changed = { ...RAW_ID, years: { ...RAW_ID.years, 1: ["평면디자인", "입체디자인"] } };
  const next = refreshCatalog(state, [changed]);
  assert.deepEqual(Object.keys(next.journeys), [RAW_ID.id]);
  assert.deepEqual(next.records, {});
  assert.deepEqual(departmentsOf(next).map((d) => d.id), [RAW_ID.id]);
});

test("과목을 처음 이수(B- 이상 또는 P)하면 크레딧을 받고, 같은 과목은 마지막으로 받은 날부터 7일이 지나야 다시 받는다", () => {
  const t0 = Date.UTC(2026, 10, 16);
  let state = enrolled();
  state = take(state, RAW_CSE.id, "미분적분학", 5, 10, t0); // D+ — 이수가 아니라 크레딧 없음
  assert.equal(state.credits, 0);
  assert.deepEqual(state.creditedAt, {});
  state = take(state, RAW_CSE.id, "미분적분학", 7, 10, t0); // B-
  assert.equal(state.credits, CREDIT_PER_PASS);
  assert.equal(state.creditedAt[courseKey(RAW_CSE.id, "미분적분학")], t0);
  // 6일 뒤 다시 이수: 크레딧 없음, 하루 남음. 받은 날은 그대로다.
  assert.equal(creditWaitDays(state, RAW_CSE.id, "미분적분학", t0 + 6 * DAY), 1);
  state = take(state, RAW_CSE.id, "미분적분학", 10, 10, t0 + 6 * DAY);
  assert.equal(state.credits, CREDIT_PER_PASS);
  assert.equal(state.creditedAt[courseKey(RAW_CSE.id, "미분적분학")], t0);
  // 다른 과목은 따로 센다.
  state = take(state, RAW_CSE.id, "객체지향프로그래밍", 9, 10, t0 + 6 * DAY);
  assert.equal(state.credits, CREDIT_PER_PASS * 2);
  // 7일이 지나면 다시 받는다.
  assert.equal(creditWaitDays(state, RAW_CSE.id, "미분적분학", t0 + CREDIT_COOLDOWN_DAYS * DAY), 0);
  state = take(state, RAW_CSE.id, "미분적분학", 9, 10, t0 + CREDIT_COOLDOWN_DAYS * DAY);
  assert.equal(state.credits, CREDIT_PER_PASS * 3);
  assert.equal(state.creditedAt[courseKey(RAW_CSE.id, "미분적분학")], t0 + CREDIT_COOLDOWN_DAYS * DAY);
  // 저장했다 불러와도 그대로이고, 이상한 값은 버린다. 학과 데이터가 없어도 받은 날은 남는다.
  assert.equal(normalize(state).credits, CREDIT_PER_PASS * 3);
  assert.deepEqual(normalize(state).creditedAt, state.creditedAt);
  assert.deepEqual(normalize({ ...state, catalog: [] }).creditedAt, state.creditedAt);
  assert.deepEqual(normalize({ ...state, creditedAt: { "x|y": "1", nokey: 5, "a|b": -1, "c|d": 3 } }).creditedAt, { "c|d": 3 });
  for (const credits of [-3, 1.5, "10", null]) assert.equal(normalize({ ...state, credits }).credits, 0);
  assert.equal(normalize({ ...state, introSeen: true }).introSeen, true);
});

test("처음 상태는 학과 데이터 없이 시작한다", () => {
  assert.deepEqual(normalize(undefined), initialState);
  assert.deepEqual(departmentsOf(initialState), []);
});

test("프로필 이름은 앞뒤 공백을 지우고 12자까지만 저장한다", () => {
  assert.equal(cleanNickname("  미래의   개발자 \n"), "미래의 개발자");
  assert.equal(cleanNickname("가".repeat(20)), "가".repeat(NICKNAME_MAX));
  assert.equal([...cleanNickname("😀".repeat(20))].length, NICKNAME_MAX);
  assert.equal(cleanNickname("   "), "");
  assert.equal(cleanNickname(42), "");
  assert.equal(normalize({ nickname: "  도토리 " }).nickname, "도토리");
  assert.equal(normalize({ nickname: { x: 1 } }).nickname, "");
  assert.equal(normalize({}).nickname, "");
});

test("프로필 사진은 새로고침과 학과 데이터 갱신 후에도 유지되고, 선택하지 않으면 기본 캐릭터다", () => {
  const photo = "data:image/jpeg;base64,/9j/AA==";
  const state = { ...enrolled(), profilePhoto: photo };
  const storage = { getItem: (key) => key === STORAGE_KEY ? JSON.stringify(state) : null };
  assert.equal(loadState(storage).profilePhoto, photo);
  assert.equal(refreshCatalog(state, [RAW_CSE]).profilePhoto, photo);
  assert.equal(normalize({ profilePhoto: "https://example.com/photo.jpg" }).profilePhoto, null);
  assert.equal(normalize({}).profilePhoto, null);
  assert.equal(normalize({ ...state, profilePhoto: null }).profilePhoto, null);
  assert.equal(initialState.profilePhoto, null);
});

test("체험이 있는 필수과목이 없어 바로 넘어간 학년을 알 수 있다(해금 규칙은 progressOf 그대로)", () => {
  // 컴퓨터공학과(테스트 데이터): 1학년은 체험이 있는 필수가 있어 처음에는 넘어간 학년이 없다.
  let state = enrolled();
  assert.deepEqual(skippedYears(progress(state)), []);
  // 1학년 필수를 이수하면 2학년(필수 체험 없음)을 넘어 3학년까지 열린다. 1학년은 들어서 지나온 학년이라 넣지 않는다.
  state = take(state, RAW_CSE.id, "객체지향프로그래밍", 8);
  state = take(state, RAW_CSE.id, "미분적분학", 8);
  assert.deepEqual(progress(state).years.map((y) => y.open), [true, true, true, false]);
  assert.deepEqual(skippedYears(progress(state)), [2]);
  // 3학년 필수를 이수해도 3학년은 넘어간 학년이 아니다. 4학년은 다음 학년이 없어 넣지 않는다.
  for (const subject of ["알고리즘", "운영체제", "졸업프로젝트"]) state = take(state, RAW_CSE.id, subject, 9);
  assert.equal(progress(state).graduated, true);
  assert.deepEqual(skippedYears(progress(state)), [2]);

  // 산업디자인학과(테스트 데이터): 드로잉을 이수하면 2·3학년이 바로 넘어가 4학년이 열리고, 졸업한 뒤에도 그대로다.
  let design = enrolled([RAW_ID], [RAW_ID.id]);
  assert.deepEqual(skippedYears(progress(design, RAW_ID.id)), []);
  design = take(design, RAW_ID.id, "드로잉", 10);
  assert.deepEqual(skippedYears(progress(design, RAW_ID.id)), [2, 3]);
  design = take(design, RAW_ID.id, "산업디자인종합설계2", "P");
  assert.equal(progress(design, RAW_ID.id).graduated, true);
  assert.deepEqual(skippedYears(progress(design, RAW_ID.id)), [2, 3]);

  // 1학년에도 체험이 있는 필수가 없으면 입학하자마자 1~3학년이 넘어가 4학년이 열린다.
  const bare = { ...RAW_ID, games: {} };
  const fresh = enrolled([bare], [bare.id]);
  assert.equal(progress(fresh, bare.id).openYear, 4);
  assert.deepEqual(skippedYears(progress(fresh, bare.id)), [1, 2, 3]);
  // 선택과목에만 체험이 있어도 필수 체험이 없으면 넘어간다.
  const electiveOnly = { ...RAW_ID, games: { 서비스디자인: "match" } };
  assert.deepEqual(skippedYears(progress(enrolled([electiveOnly], [electiveOnly.id]), electiveOnly.id)), [1, 2, 3]);
});

test("학과를 그만두면 그 학과의 입학·성적·체험 결과·한 줄 기록·쓰던 기록·조건 예외만 지우고 크레딧과 받은 시각은 남긴다", () => {
  // 학과 id 앞부분이 겹치는 학과("khu-cse"와 "khu-cse2")를 함께 둔다.
  const RAW_CSE2 = { ...RAW_CSE, id: "khu-cse2", name: "컴퓨터공학과2" };
  const t0 = Date.UTC(2026, 10, 16);
  let state = enrolled([RAW_CSE, RAW_CSE2, RAW_ID], [RAW_CSE.id, RAW_CSE2.id, RAW_ID.id]);
  for (const id of [RAW_CSE.id, RAW_CSE2.id]) state = take(state, id, "미분적분학", 9, 10, t0);
  state = take(state, RAW_ID.id, "드로잉", 9, 10, t0);
  const key = (id, subject) => courseKey(id, subject);
  for (const id of [RAW_CSE.id, RAW_CSE2.id]) {
    state = savePlay(state, id, "객체지향프로그래밍", gameOf(departmentsOf(state).find((d) => d.id === id), "객체지향프로그래밍"), "결과", { correct: 8, total: 10 });
    state = {
      ...state,
      notes: { ...state.notes, [key(id, "미분적분학")]: "재밌었다" },
      drafts: { ...state.drafts, [key(id, "이산구조")]: "쓰던 기록" },
      exempt: { ...state.exempt, [key(id, "컴퓨터구조")]: true },
    };
  }
  state = { ...state, studying: RAW_ID.id, current: RAW_ID.id };
  const before = structuredClone(state);
  const left = leaveDepartment(state, RAW_CSE.id);
  // 입력 상태는 바꾸지 않는다.
  assert.deepEqual(state, before);
  assert.deepEqual(Object.keys(left.journeys), [RAW_CSE2.id, RAW_ID.id]);
  for (const field of ["records", "plays", "notes", "drafts", "exempt"]) {
    const keys = Object.keys(left[field]);
    assert.ok(!keys.some((k) => k.startsWith(`${RAW_CSE.id}|`)), `${field}에 그만둔 학과 기록이 남았어요`);
    // 다른 학과(앞부분이 겹치는 khu-cse2 포함)의 기록은 그대로다.
    const others = Object.fromEntries(Object.entries(before[field]).filter(([k]) => !k.startsWith(`${RAW_CSE.id}|`)));
    assert.deepEqual(left[field], others, field);
    assert.ok(keys.some((k) => k.startsWith(`${RAW_CSE2.id}|`)), `${field}에서 khu-cse2 기록이 지워졌어요`);
  }
  assert.ok(left.records[key(RAW_CSE2.id, "미분적분학")]);
  assert.ok(left.plays[key(RAW_CSE2.id, "객체지향프로그래밍")]);
  assert.ok(left.records[key(RAW_ID.id, "드로잉")]);
  // 크레딧과 받은 시각은 남는다. 체험 중인 학과가 아니었으므로 studying·current는 그대로다.
  assert.equal(left.credits, before.credits);
  assert.deepEqual(left.creditedAt, before.creditedAt);
  assert.equal(left.studying, RAW_ID.id);
  assert.equal(left.current, RAW_ID.id);
  // 저장했다 불러와도 그만둔 학과는 돌아오지 않는다.
  assert.deepEqual(Object.keys(normalize(left).journeys), [RAW_CSE2.id, RAW_ID.id]);
});

test("체험 중인 학과를 그만두면 남은 학과 중 가장 최근에 입학한 학과로 바뀌고, 남은 학과가 없으면 null이다", () => {
  let state = enrolled([RAW_CSE, RAW_ID], [RAW_CSE.id, RAW_ID.id]);
  state = { ...state, studying: RAW_ID.id, current: RAW_ID.id };
  state = leaveDepartment(state, RAW_ID.id);
  assert.equal(state.studying, RAW_CSE.id);
  assert.equal(state.current, RAW_CSE.id);
  state = leaveDepartment(state, RAW_CSE.id);
  assert.deepEqual(state.journeys, {});
  assert.equal(state.studying, null);
  assert.equal(state.current, null);
  // 다시 입학하고 그만둔 순서가 섞여도 가장 최근에 입학한 학과로 바뀐다.
  let mixed = enroll(enroll(enrolled([RAW_CSE, RAW_ID], []), RAW_CSE.id), RAW_ID.id);
  mixed = enroll(leaveDepartment(mixed, RAW_CSE.id), RAW_CSE.id);
  assert.deepEqual(Object.keys(mixed.journeys), [RAW_ID.id, RAW_CSE.id]);
  assert.equal(leaveDepartment({ ...mixed, studying: RAW_ID.id }, RAW_ID.id).studying, RAW_CSE.id);
});

test("입학하지 않은 학과를 그만두면 상태를 그대로 돌려준다", () => {
  const state = enrolled();
  for (const id of [RAW_ID.id, "khu", "khu-cse2", "", null, undefined, "__proto__", "toString"]) assert.equal(leaveDepartment(state, id), state);
});

test("그만둔 학과에 다시 입학하면 1학년부터 새로 시작하고, 7일 안에 같은 과목을 다시 이수하면 크레딧을 받지 않는다", () => {
  const t0 = Date.UTC(2026, 10, 16);
  let state = enrolled();
  state = take(state, RAW_CSE.id, "미분적분학", 9, 10, t0);
  assert.equal(state.credits, CREDIT_PER_PASS);
  state = leaveDepartment(state, RAW_CSE.id);
  assert.equal(state.credits, CREDIT_PER_PASS);
  state = enroll(state, RAW_CSE.id, t0 + DAY);
  assert.equal(state.journeys[RAW_CSE.id].enrolledAt, t0 + DAY);
  const p = progress(state);
  assert.equal(p.openYear, 1);
  assert.equal(p.passedCount, 0);
  assert.equal(p.taken.length, 0);
  // 6일 뒤 같은 과목: 이수는 되지만 크레딧은 받지 않는다.
  state = take(state, RAW_CSE.id, "미분적분학", 10, 10, t0 + 6 * DAY);
  assert.equal(recordOf(state, RAW_CSE.id, "미분적분학").grade, "A+");
  assert.equal(state.credits, CREDIT_PER_PASS);
  // 7일이 지나면 받는다.
  state = take(state, RAW_CSE.id, "미분적분학", 10, 10, t0 + CREDIT_COOLDOWN_DAYS * DAY);
  assert.equal(state.credits, CREDIT_PER_PASS * 2);
});

test("로그인 결과 화면: 서버가 확정한 뒤에만 이번에 받은 크레딧을 알린다(#98)", () => {
  const key = courseKey(RAW_CSE.id, "미분적분학");
  const before = { credits: 10, at: null };
  // 보낼 기록이 남아 있거나 저장 중·연결 대기면 아직 확정 전이다.
  for (const sync of [{ phase: "waiting", pending: 1 }, { phase: "saving", pending: 1 }, { phase: "saved", pending: 1 }, { phase: "expired", pending: 0 }, null])
    assert.deepEqual(serverCreditOf(before, { credits: 15, creditedAt: { [key]: 1 } }, key, sync), { confirmed: false, credits: 0 });
  const saved = { phase: "saved", pending: 0 };
  // 서버가 이번에 지급했다(지급 시각이 생기고 잔액이 5 늘었다).
  assert.deepEqual(serverCreditOf(before, { credits: 15, creditedAt: { [key]: 1700000000000 } }, key, saved), { confirmed: true, credits: 5 });
  // 7일 규칙 등으로 지급하지 않았다(지급 시각이 그대로).
  const earlier = { credits: 10, at: 1600000000000 };
  assert.deepEqual(serverCreditOf(earlier, { credits: 10, creditedAt: { [key]: 1600000000000 } }, key, saved), { confirmed: true, credits: 0 });
  // 지급 시각이 그대로면 다른 기기에서 늘어난 잔액은 이 과목의 지급으로 보지 않는다.
  assert.deepEqual(serverCreditOf(earlier, { credits: 15, creditedAt: { [key]: 1600000000000 } }, key, saved), { confirmed: true, credits: 0 });
  // 확정 전 값이 없으면(비로그인) 확정하지 않는다.
  assert.deepEqual(serverCreditOf(null, { credits: 15 }, key, saved), { confirmed: false, credits: 0 });
});
