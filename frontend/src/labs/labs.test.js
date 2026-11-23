import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CHECKED, CONDITIONS, LAB_DATA, LABS, RESTORED, addedSince, checkProblems, isLabId, labOf, labProblems, labsFrom, takeawayProblems } from "./index.js";
import { CHECKS } from "./checks.js";
import { courseKey, completeCourse, departmentsOf, gameOf, initialState, isPlanned, normalize, progressOf, savePlay, skippedYears } from "../model.js";
import { isGame } from "../games.js";
import { RAW_CSE } from "../testFixtures.js";

// 프론트와 서버가 함께 읽는 등록부(#103). index.js를 거치지 않고 파일을 직접 읽어 비교한다.
const REGISTRY = JSON.parse(readFileSync(new URL("../../../backend/data/record_conditions.json", import.meta.url), "utf8"));
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
  const ids = Object.values(LABS).flatMap((subjects) => Object.values(subjects).map((lab) => lab.id));
  for (const id of ["python-functions", "stack-queue", "web-python"]) assert.ok(!ids.includes(id), `${id}는 뺀 체험이다`);
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

test("다시 공개한 이론 퀴즈 15과목은 이수 조건 버전 3으로 등록돼 있다", () => {
  // 지금 버전은 등록부 파일의 version이다(체험을 공개할 때 올리므로 숫자로 고정하지 않는다).
  assert.equal(CONDITIONS, REGISTRY.version);
  assert.ok(CONDITIONS >= 3);
  assert.equal(Object.keys(RESTORED[RAW.id]).length, 15);
  // 이론 퀴즈를 다시 공개한 것은 버전 3이었다. 그 뒤 버전이 올라도 이 값은 그대로다.
  assert.ok(Object.values(RESTORED[RAW.id]).every((since) => since === 3));
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

// 형식 검사용 시험 체험. 테스트에만 있고 등록부(LABS)·화면 번들에는 넣지 않는다.
const TEST_LAB = {
  id: "test-lab",
  status: "verified",
  since: CONDITIONS,
  title: "시험 체험",
  task: "시험용 과제",
  source: "시험용 근거",
  takeaway: {
    summary: "이 수업은 시험용 활동을 해 보는 수업이에요.",
    highSchool: "고등학교 수학의 함수와 이어져요.",
    terms: [{ name: "시험 용어", meaning: "방금 해 본 활동의 이름이에요." }],
  },
};
const TEST_CHECK = { reviewer: "QA 세션", reviewedAt: "2026-11-17T15:00:00+09:00", removed: [{ item: "3번 문항", reason: "답이 둘이에요" }] };
const registry = (lab) => ({ [RAW.id]: { [WEB]: lab } });

test("끝 요약(takeaway)은 { summary, highSchool, terms[] } 형식이어야 한다", () => {
  assert.deepEqual(labProblems(TEST_LAB), []);
  // 예전처럼 문자열 하나인 takeaway는 형식이 틀렸다.
  assert.ok(takeawayProblems("이 수업은 ○○를 하는 수업이에요.").length > 0);
  assert.ok(takeawayProblems(undefined).length > 0);
  assert.ok(takeawayProblems([]).length > 0);
  const bad = (change) => takeawayProblems({ ...TEST_LAB.takeaway, ...change });
  assert.ok(bad({ summary: "  " }).length > 0);
  assert.ok(bad({ highSchool: undefined }).length > 0);
  assert.ok(bad({ terms: [] }).length > 0);
  assert.ok(bad({ terms: "용어" }).length > 0);
  assert.ok(bad({ terms: [{ name: "용어" }] }).length > 0);
  assert.ok(bad({ terms: [null] }).length > 0);
  assert.ok(bad({ terms: [{ name: "용어", meaning: "뜻" }, { name: "용어", meaning: "다른 뜻" }] }).length > 0);
  // 체험 전체 검사에도 들어간다.
  assert.ok(labProblems({ ...TEST_LAB, takeaway: "문자열" }).length > 0);
  assert.ok(labProblems({ ...TEST_LAB, id: "Test Lab" }).length > 0);
  assert.ok(labProblems({ ...TEST_LAB, title: "" }).length > 0);
});

test("검증 기록(check)은 검토자·검토 시각·뺀 항목과 이유를 갖춰야 한다", () => {
  assert.deepEqual(checkProblems(TEST_CHECK), []);
  assert.deepEqual(checkProblems({ ...TEST_CHECK, reviewedAt: "2026-11-17", removed: [] }), []);
  assert.ok(checkProblems(undefined).length > 0);
  assert.ok(checkProblems({ ...TEST_CHECK, reviewer: "" }).length > 0);
  assert.ok(checkProblems({ ...TEST_CHECK, reviewedAt: "어제" }).length > 0);
  assert.ok(checkProblems({ ...TEST_CHECK, reviewedAt: "2026-02-30" }).length > 0);
  assert.ok(checkProblems({ ...TEST_CHECK, removed: undefined }).length > 0);
  assert.ok(checkProblems({ ...TEST_CHECK, removed: [{ item: "3번 문항" }] }).length > 0);
});

test("검증 기록이 없거나 형식이 틀린 체험은 verified여도 공개하지 않는다", () => {
  // 검증 기록이 있으면 공개한다.
  assert.equal(labOf(RAW.id, WEB, registry(TEST_LAB), [TEST_LAB.id]), TEST_LAB);
  // 검증 기록이 없으면 verified여도 null.
  assert.equal(labOf(RAW.id, WEB, registry(TEST_LAB), []), null);
  // 검토 전(verified 아님)이면 기록이 있어도 null.
  assert.equal(labOf(RAW.id, WEB, registry({ ...TEST_LAB, status: "draft" }), [TEST_LAB.id]), null);
  // takeaway 형식이 틀리면 null.
  assert.equal(labOf(RAW.id, WEB, registry({ ...TEST_LAB, takeaway: "문자열" }), [TEST_LAB.id]), null);
  // 없는 학과·과목.
  assert.equal(labOf("khu-id", WEB, registry(TEST_LAB), [TEST_LAB.id]), null);
  assert.equal(labOf(RAW.id, DS, registry(TEST_LAB), [TEST_LAB.id]), null);
});

// 서버(backend/record_rules.py check_conditions)와 같은 등록부 형식 검사. 맞으면 빈 배열.
function registryProblems(registry) {
  const problems = [];
  const ids = new Set();
  for (const [department, subjects] of Object.entries(registry.labs)) {
    for (const [subject, entry] of Object.entries(subjects)) {
      const where = `labs.${department}.${subject}`;
      if (!entry || typeof entry !== "object" || Object.keys(entry).sort().join() !== "id,since,status") {
        problems.push(`${where}는 { id, status, since }만 가져요`);
        continue;
      }
      if (typeof entry.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.id)) problems.push(`${where}.id는 kebab-case예요`);
      if (ids.has(entry.id)) problems.push(`${where}.id(${entry.id})가 겹쳐요`);
      ids.add(entry.id);
      if (!["verified", "draft"].includes(entry.status)) problems.push(`${where}.status는 verified·draft예요`);
      // 검토 전(draft)에는 version을 올리지 않고 넣는다. verified로 바꾸는 커밋에서 version을 1 올리고 since를 그 값으로 둔다.
      if (!Number.isInteger(entry.since) || entry.since < 1 || entry.since > registry.version)
        problems.push(`${where}.since는 1 이상 version(${registry.version}) 이하예요${entry.status === "draft" ? "(draft는 version을 올리지 않고 넣어요)" : ""}`);
    }
  }
  return problems;
}

test("등록부(record_conditions.json의 labs)는 서버와 같은 형식이고, 체험마다 문구 모듈이 있다", () => {
  assert.deepEqual(registryProblems(REGISTRY), []);
  for (const [department, subjects] of Object.entries(REGISTRY.labs))
    for (const [subject, entry] of Object.entries(subjects)) {
      assert.ok(Object.hasOwn(LAB_DATA, entry.id), `${entry.id}의 문구 모듈(LAB_DATA)`);
      // 화면은 등록부의 공개 여부·since를 그대로 쓴다.
      const lab = LABS[department][subject];
      assert.deepEqual([lab.id, lab.status, lab.since], [entry.id, entry.status, entry.since]);
      // verified면 검증 기록이 있고 형식이 맞아 화면에도 공개된다(서버가 받는 체험과 같다).
      if (entry.status === "verified") {
        assert.ok(CHECKED.includes(entry.id), `${entry.id}의 검증 기록(CHECKED)`);
        assert.deepEqual(labProblems(lab), [], `${entry.id}의 형식`);
        assert.equal(labOf(department, subject), lab);
      } else assert.equal(labOf(department, subject), null);
    }
});

test("등록부 형식 검사: draft의 since가 version보다 크면(버전을 미리 올리지 않으면) 실패한다", () => {
  const with_ = (entry, version = 3) => ({ version, restored: {}, labs: { [RAW.id]: { [WEB]: entry } } });
  const ok = { id: "oop-class", status: "draft", since: 3 };
  assert.deepEqual(registryProblems(with_(ok)), []);
  assert.ok(registryProblems(with_({ ...ok, since: 4 })).length > 0);
  assert.ok(registryProblems(with_({ ...ok, status: "verified", since: 4 })).length > 0);
  assert.deepEqual(registryProblems(with_({ ...ok, status: "verified", since: 4 }, 4)), []);
  assert.ok(registryProblems(with_({ ...ok, since: 0 })).length > 0);
  assert.ok(registryProblems(with_({ ...ok, status: "published" })).length > 0);
  assert.ok(registryProblems(with_({ ...ok, id: "OOP class" })).length > 0);
  assert.ok(registryProblems(with_({ ...ok, title: "문구는 모듈에" })).length > 0);
  const twice = { version: 3, restored: {}, labs: { [RAW.id]: { [WEB]: ok, [DS]: ok } } };
  assert.ok(registryProblems(twice).length > 0);
});

test("labsFrom: 등록부에 문구를 붙이고, 공개 여부·since는 등록부 값을 쓴다. 문구가 없으면 공개하지 않는다", () => {
  const { id: _id, status: _status, since: _since, ...text } = TEST_LAB;
  const entry = { id: TEST_LAB.id, status: "verified", since: CONDITIONS };
  const labs = labsFrom({ [RAW.id]: { [WEB]: entry } }, { [TEST_LAB.id]: { ...text, status: "draft", since: 99 } });
  assert.deepEqual(labs[RAW.id][WEB], { ...text, ...entry });
  assert.equal(labOf(RAW.id, WEB, labs, [TEST_LAB.id]), labs[RAW.id][WEB]);
  // 문구 모듈이 없으면 형식이 틀린 체험이라 verified여도 공개하지 않는다.
  const bare = labsFrom({ [RAW.id]: { [WEB]: entry } }, {});
  assert.ok(labProblems(bare[RAW.id][WEB]).length > 0);
  assert.equal(labOf(RAW.id, WEB, bare, [TEST_LAB.id]), null);
});

test("등록부의 모든 체험은 형식이 맞고, 공개한 체험은 모두 검증 기록이 있다", () => {
  const labs = Object.values(LABS).flatMap((subjects) => Object.values(subjects));
  for (const lab of labs) assert.deepEqual(labProblems(lab), [], `${lab?.id}의 형식`);
  // verified인데 검증 기록이 없으면 화면에서 조용히 빠지므로 테스트에서 먼저 막는다.
  for (const lab of labs.filter((lab) => lab.status === "verified")) assert.ok(CHECKED.includes(lab.id), `${lab.id}의 검증 기록(CHECKED)`);
  // CHECKED와 checks.js가 맞는다: 기록이 있고 형식이 맞는 id만, 빠짐없이.
  assert.equal(new Set(CHECKED).size, CHECKED.length);
  assert.deepEqual([...CHECKED].sort(), Object.keys(CHECKS).sort());
  for (const id of CHECKED) {
    assert.deepEqual(checkProblems(CHECKS[id]), [], `${id}의 검증 기록 형식`);
    assert.ok(labs.some((lab) => lab.id === id), `${id}가 등록부에 있다`);
  }
});

test("검증 기록(checks.js)은 앱 코드에서 불러오지 않는다(학생 화면·번들에 넣지 않는다)", () => {
  const src = fileURLToPath(new URL("..", import.meta.url));
  const files = readdirSync(src, { recursive: true }).filter((file) => /\.(js|jsx)$/.test(file) && !/\.test\.js$/.test(file));
  assert.ok(files.length > 10);
  for (const file of files) {
    const code = readFileSync(`${src}/${file}`, "utf8");
    assert.doesNotMatch(code, /(from|import)\s*\(?\s*["'][^"']*checks(\.js)?["']/, `${file}가 checks.js를 불러온다`);
  }
});

test("새 체험이 생겨 예외(exempt)로 열려 있는 학년은 '바로 넘어간 학년'이 아니다(새 체험으로 알린다)", () => {
  // 이론 퀴즈를 내렸던 동안 3학년까지 열린 사용자: 1·2학년에는 다시 생긴 필수 퀴즈(미분적분학·컴퓨터구조)가 있다.
  const state = normalize(savedAt(2));
  const progress = progressOf(state, dept(state));
  assert.deepEqual(progress.years.map((y) => y.open), [true, true, true, false]);
  assert.deepEqual(skippedYears(progress), []);
});
