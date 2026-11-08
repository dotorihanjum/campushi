import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  OLD_STORAGE_KEYS,
  QUESTIONS,
  STORAGE_KEY,
  completeCourse,
  courseKey,
  createDepartment,
  departmentsOf,
  gameOf,
  initialState,
  isPlanned,
  isRequired,
  kindOf,
  loadState,
  normalize,
  progressOf,
  recommend,
  recordOf,
  refreshCatalog,
  savePlay,
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
function take(state, id, subject, correct, total = 10) {
  const d = departmentsOf(state).find((item) => item.id === id);
  const score = correct === "P" ? "P" : { correct, total };
  return completeCourse(savePlay(state, id, subject, gameOf(d, subject), "결과", score), id, subject, "");
}
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

test("과목마다 이수구분·학년·체험(졸업 과제, 전공 실습, 연습 문제, 구현 예정)이 정해진다", () => {
  const d = createDepartment(RAW_CSE);
  assert.equal(gameOf(d, "졸업프로젝트"), "final");
  assert.equal(gameOf(d, "알고리즘"), "group:computing");
  assert.equal(gameOf(d, "미분적분학"), "theory");
  assert.equal(gameOf(d, "객체지향프로그래밍"), "match");
  assert.ok(isPlanned(d, "이산구조") && isPlanned(d, "자료구조"));
  assert.ok(!isPlanned(d, "졸업프로젝트"));
  assert.equal(yearOf(d, "운영체제"), 3);
  assert.equal(yearOf(d, "없는과목"), null);
  assert.ok(isRequired(d, "자료구조") && !isRequired(d, "이산구조"));
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
  // 2학년 필수(자료구조·컴퓨터구조)는 체험이 없어 조건에서 빠지므로 3학년까지 바로 열린다.
  assert.deepEqual(p.years.map((y) => y.open), [true, true, true, false]);
  assert.deepEqual(p.years[1].left, []);
  assert.deepEqual(p.years[2].left.map((c) => c.subject), ["알고리즘", "운영체제"]);
  assert.equal(p.passedCount, 2);
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

test("학과 추천은 답이 가리키는 학과를 세고, 같으면 함께 추천한다", () => {
  const list = [createDepartment(RAW_CSE), createDepartment(RAW_ID)];
  const answer = (ids) => Object.fromEntries(QUESTIONS.map((q, i) => [i + 1, q.options.find((o) => o.id === ids[i]).label]));
  assert.equal(recommend({}, list), null);
  assert.equal(recommend({ 1: QUESTIONS[0].options[0].label }, list), null);
  assert.equal(recommend(answer(["khu-cse", "khu-cse", "khu-cse", "khu-id"]), []), null);
  const cse = recommend(answer(["khu-cse", "khu-cse", "khu-cse", "khu-id"]), list);
  assert.equal(cse.best.id, "khu-cse");
  assert.deepEqual(cse.others.map((d) => d.id), ["khu-id"]);
  assert.equal(cse.count, 3);
  assert.equal(cse.total, 4);
  assert.equal(cse.tie, false);
  assert.equal(recommend(answer(["khu-id", "khu-id", "khu-id", "khu-id"]), list).best.id, "khu-id");
  const tie = recommend(answer(["khu-id", "khu-cse", "khu-id", "khu-cse"]), list);
  assert.equal(tie.tie, true);
  assert.equal(tie.count, 2);
  // 질문의 보기는 모두 두 학과 중 하나를 가리키고, 질문마다 두 학과가 반반이다.
  for (const q of QUESTIONS) {
    assert.deepEqual(
      q.options.map((o) => o.id).sort(),
      ["khu-cse", "khu-cse", "khu-id", "khu-id"],
      q.title,
    );
  }
});

test("처음 상태는 학과 데이터 없이 시작한다", () => {
  assert.deepEqual(normalize(undefined), initialState);
  assert.deepEqual(departmentsOf(initialState), []);
});
