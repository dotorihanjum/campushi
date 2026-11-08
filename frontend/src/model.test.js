import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CHOOSE_TITLE,
  QUESTIONS,
  STORAGE_KEY,
  chooseSubject,
  completeLesson,
  createDepartment,
  departmentsOf,
  initialState,
  isPlanned,
  loadState,
  plannedAt,
  normalize,
  progressOf,
  recommend,
  refreshCatalog,
  skipLesson,
  stageLabel,
  shortStage,
  withChoices,
  yearSubjects,
} from "./model.js";
import { RAW_CSE, RAW_ID } from "./testFixtures.js";

const enrolled = (raws = [RAW_CSE], extra = {}) => ({
  ...structuredClone(initialState),
  catalog: raws,
  journeys: Object.fromEntries(raws.map((raw) => [raw.id, { completed: 0, paused: false }])),
  ...extra,
});

test("실제 학과 데이터(서버 파일)는 프런트 형식 검사를 통과하고, 8학기 자리가 된다", () => {
  const { departments } = JSON.parse(readFileSync(new URL("../../backend/data/departments.json", import.meta.url), "utf-8"));
  assert.deepEqual(departments.map((raw) => raw.id), ["khu-cse", "khu-id"]);
  for (const raw of departments) {
    const d = createDepartment(raw);
    assert.ok(d, raw.id);
    assert.equal(d.lessons.length, 8);
    assert.deepEqual(d.yearNumbers, [1, 1, 2, 2, 3, 3, 4, 4]);
    assert.deepEqual(d.semesters, [1, 2, 1, 2, 1, 2, 1, 2]);
    // 학기 자리는 그 학년 편성표 전체 과목(졸업 과제 과목 제외)이고, 4학년 2학기는 졸업 과제(고르지 않음)다.
    d.options.slice(0, 7).forEach((options, i) => assert.deepEqual(options, raw.years[d.yearNumbers[i]].filter((s) => s !== raw.final)));
    assert.equal(d.options[7], null);
    assert.equal(d.lessons[7], raw.final);
    assert.ok(d.partner && d.partnerExample);
    assert.ok(d.source.url.startsWith("https://"));
  }
  // 학과군 실습은 컴퓨터·AI(알고리즘 → 버블 정렬)만 공개한다. 디자인 실습은 다시 만들 때까지 구현 예정이다.
  assert.ok(createDepartment(departments[0]).practiceSubject && createDepartment(departments[0]).practice);
  assert.equal(createDepartment(departments[1]).practice, null);
  assert.equal(createDepartment(departments[0]).final.template, "G");
  assert.equal(createDepartment(departments[1]).final.kind, "artwork");
});

test("형식이 틀린 학과 데이터는 쓰지 않는다", () => {
  assert.equal(createDepartment(null), null);
  assert.equal(createDepartment({ ...RAW_CSE, group: "music" }), null);
  assert.equal(createDepartment({ ...RAW_CSE, id: "" }), null);
  // 1·2학기에 하나씩 고르므로 학년마다 (졸업 과제 과목을 빼고) 두 과목 이상 있어야 한다.
  assert.equal(createDepartment({ ...RAW_CSE, years: { ...RAW_CSE.years, 2: ["자료구조"] } }), null);
  assert.equal(createDepartment({ ...RAW_CSE, years: { ...RAW_CSE.years, 4: ["정보보호", "졸업프로젝트"] } }), null);
  assert.equal(createDepartment({ ...RAW_CSE, final: "없는과목" }), null);
  // 실습 과목이 편성표에 없으면 실습 없이 진행한다.
  assert.equal(createDepartment({ ...RAW_CSE, practice: "없는과목" }).practiceSubject, null);
});

test("학기 이름과 학년별 과목 목록", () => {
  const d = createDepartment(RAW_CSE);
  assert.equal(stageLabel(d, 0), "1학년 1학기");
  assert.equal(stageLabel(d, 7), "4학년 2학기");
  assert.equal(shortStage(d, 5), "3-2");
  // open은 체험이 있는 과목(연습 문제·실습·졸업 과제), others는 체험 구현 예정 과목이다.
  assert.deepEqual(yearSubjects(d)[0], { year: 1, open: ["객체지향프로그래밍"], others: ["이산구조", "미분적분학"] });
  assert.deepEqual(yearSubjects(d)[2], { year: 3, open: ["알고리즘", "운영체제"], others: ["컴파일러"] });
  assert.deepEqual(yearSubjects(d)[3], { year: 4, open: ["졸업프로젝트"], others: ["정보보호", "캡스톤디자인", "졸업논문"] });
  assert.deepEqual(d.options[6], ["정보보호", "캡스톤디자인", "졸업논문"]);
});

test("과목은 지금 학기 자리에서만, 그 학년 과목 중 다른 학기에 고르지 않은 것으로 고른다", () => {
  const id = RAW_CSE.id;
  let state = enrolled();
  assert.equal(chooseSubject(state, id, 1, "이산구조"), state, "아직 오지 않은 학기");
  assert.equal(chooseSubject(state, id, 0, "자료구조"), state, "다른 학년 과목");
  state = chooseSubject(state, id, 0, "객체지향프로그래밍");
  assert.equal(state.choices[`${id}-0`], "객체지향프로그래밍");
  // 과목을 바꾸면 그 자리에서 해 둔 체험과 쓰던 기록은 지운다.
  const played = { ...state, plays: { [`${id}-0`]: { game: "match", summary: "x" } }, drafts: { [`${id}-0`]: "쓰던 글" } };
  const changed = chooseSubject(played, id, 0, "이산구조");
  assert.equal(changed.choices[`${id}-0`], "이산구조");
  assert.deepEqual(changed.plays, {});
  assert.deepEqual(changed.drafts, {});
  // 1학기를 마치면 2학기에는 1학기에 고른 과목을 다시 고를 수 없다.
  state = { ...state, plays: { [`${id}-0`]: { game: "match", summary: "x" } } };
  state = completeLesson(state, id, 0, "");
  assert.equal(state.journeys[id].completed, 1);
  assert.equal(chooseSubject(state, id, 1, "객체지향프로그래밍"), state);
  state = chooseSubject(state, id, 1, "이산구조");
  const d = withChoices(createDepartment(RAW_CSE), state.choices);
  assert.deepEqual(d.lessons.slice(0, 3), ["객체지향프로그래밍", "이산구조", CHOOSE_TITLE]);
  assert.deepEqual(d.chosen.slice(0, 3), [true, true, false]);
  // 졸업 과제 자리는 고르지 않는다.
  assert.equal(chooseSubject({ ...state, journeys: { [id]: { completed: 7, paused: false } } }, id, 7, "졸업프로젝트").choices[`${id}-7`], undefined);
});

test("실습 과목은 학과군 실습을, 졸업 과제는 끝까지 해봐야 완료되고 8학기를 마치면 졸업한다", () => {
  const id = RAW_CSE.id;
  let state = enrolled();
  const picks = ["이산구조", "객체지향프로그래밍", "자료구조", "컴퓨터구조", "알고리즘", "운영체제", "정보보호"];
  picks.forEach((subject, i) => {
    assert.equal(completeLesson(state, id, i, ""), state, "고르기 전에는 완료할 수 없다");
    state = chooseSubject(state, id, i, subject);
    const game = withChoices(createDepartment(RAW_CSE), state.choices).games[i];
    if (subject === "알고리즘") assert.equal(game, "group:computing");
    if (game) {
      assert.equal(completeLesson(state, id, i, ""), state, "체험을 해본 뒤에 완료한다");
      state = { ...state, plays: { ...state.plays, [`${id}-${i}`]: { game, summary: "" } } };
    }
    state = completeLesson(state, id, i, i === 0 ? "첫 기록" : "");
    assert.equal(state.journeys[id].completed, i + 1);
  });
  assert.equal(state.notes[`${id}-0`], "첫 기록");
  assert.equal(completeLesson(state, id, 7, ""), state, "졸업 과제를 해보기 전");
  state = completeLesson({ ...state, artworks: { [id]: true } }, id, 7, "마치며");
  assert.deepEqual(progressOf(state.journeys[id], 8), { completed: 8, skipped: [], passed: 8, finished: true });
});

test("체험이 없는 과목은 구현 예정으로, 체험 없이 넘어가고 구현 예정으로 표시된다", () => {
  const id = RAW_CSE.id;
  let state = chooseSubject(enrolled(), id, 0, "이산구조");
  let d = withChoices(createDepartment(RAW_CSE), state.choices);
  assert.ok(isPlanned(d, "이산구조") && !isPlanned(d, "객체지향프로그래밍") && !isPlanned(d, "알고리즘"));
  assert.equal(plannedAt(d, 0), true);
  assert.equal(plannedAt(d, 1), false, "아직 고르지 않은 자리");
  state = completeLesson(state, id, 0, "");
  assert.deepEqual(progressOf(state.journeys[id], 8), { completed: 1, skipped: [], passed: 1, finished: false });
  state = chooseSubject(state, id, 1, "객체지향프로그래밍");
  d = withChoices(createDepartment(RAW_CSE), state.choices);
  assert.equal(plannedAt(d, 1), false);
});

test("휴강하면 미이수로 남고, 다시 들어 완료하면 이수로 바뀐다", () => {
  const id = RAW_ID.id;
  let state = enrolled([RAW_ID]);
  assert.equal(skipLesson(state, id, 0), state, "과목을 고르기 전에는 휴강할 수 없다");
  state = skipLesson(chooseSubject(state, id, 0, "평면디자인"), id, 0);
  assert.deepEqual(state.journeys[id], { completed: 1, paused: false, skipped: [0] });
  assert.deepEqual(progressOf(state.journeys[id], 8), { completed: 1, skipped: [0], passed: 0, finished: false });
  state = completeLesson(state, id, 0, "다시 들었어요");
  assert.deepEqual(state.journeys[id], { completed: 1, paused: false, skipped: [] });
});

test("저장된 기록은 지금 형식에 맞는 것만 불러온다", () => {
  const id = RAW_CSE.id;
  const saved = {
    ...enrolled([RAW_CSE, { id: "broken" }]),
    journeys: { [id]: { completed: 99, skipped: [0, 0, 50, "x"] }, 없는학과: { completed: 1 } },
    choices: { [`${id}-0`]: "객체지향프로그래밍", [`${id}-1`]: "객체지향프로그래밍", [`${id}-2`]: "없는과목", [`${id}-7`]: "졸업프로젝트" },
    plays: { [`${id}-0`]: { game: "match", summary: "결과" }, [`${id}-1`]: { game: "stroop", summary: "" } },
    notes: { [`${id}-0`]: "기록", [`${id}-9`]: "범위 밖", [`${id}-1`]: 3 },
    artworks: { [id]: true, 없는학과: true },
    answers: { 1: QUESTIONS[0].options[0].label, 2: "없는 보기" },
    current: id,
    studying: "없는학과",
    onboarded: true,
  };
  const state = loadState({ getItem: (key) => (key === STORAGE_KEY ? JSON.stringify(saved) : null) });
  assert.deepEqual(state.catalog.map((raw) => raw.id), [id]);
  assert.deepEqual(state.journeys, { [id]: { completed: 8, paused: false, skipped: [0] } });
  assert.deepEqual(state.choices, { [`${id}-0`]: "객체지향프로그래밍" });
  assert.deepEqual(state.plays, { [`${id}-0`]: { game: "match", summary: "결과" } });
  assert.deepEqual(state.notes, { [`${id}-0`]: "기록" });
  assert.deepEqual(state.artworks, { [id]: true });
  assert.deepEqual(state.answers, { 1: QUESTIONS[0].options[0].label });
  assert.equal(state.current, id);
  assert.equal(state.studying, null);
  assert.equal(state.onboarded, true);
  // 읽을 수 없는 저장 값은 처음 상태로 시작한다.
  assert.deepEqual(loadState({ getItem: () => "{깨짐" }), initialState);
  assert.deepEqual(loadState({ getItem: () => null }), initialState);
});

test("서버에서 새 학과 데이터를 받으면 바꾸고, 쓸 수 없는 데이터면 저장해 둔 것을 쓴다", () => {
  const state = chooseSubject(enrolled([RAW_CSE, RAW_ID]), RAW_ID.id, 0, "드로잉");
  assert.equal(refreshCatalog(state, []), state);
  assert.equal(refreshCatalog(state, [{ id: "x" }]), state);
  // 학과가 빠지면 그 학과의 기록도 정리하고, 편성이 바뀌어 없어진 과목의 선택은 지운다.
  const changed = { ...RAW_ID, years: { ...RAW_ID.years, 1: ["평면디자인", "입체디자인"] } };
  const next = refreshCatalog(state, [changed]);
  assert.deepEqual(Object.keys(next.journeys), [RAW_ID.id]);
  assert.deepEqual(next.choices, {});
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
