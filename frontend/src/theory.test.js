import test from "node:test";
import assert from "node:assert/strict";
import { cleanGame, questionsOf } from "./lessonGames.js";
import { ROUNDS, revealsUnit, roundTitles, roundTypesOf, theoryRounds } from "./theory.js";

// 형식 검사용 예시 은행. 서비스 데이터가 아니다.
const BANK = cleanGame({
  type: "theory",
  course_name: "예시 과목",
  title: "예시 퀴즈",
  explanation: "예시 과목의 개념을 확인해요.",
  source: "강의계획서",
  status: "verified",
  units: ["가 단원", "나 단원", "다 단원"],
  terms: Array.from({ length: 12 }, (_, n) => ({ term: `용어${n}`, meaning: `뜻${n}`, unit: n % 3 })),
  facts: Array.from({ length: 8 }, (_, n) => ({ text: `문장${n}`, answer: n % 3 === 0, explanation: `해설${n}` })),
  sequences: [{ prompt: "순서대로 놓아요.", steps: ["하나", "둘", "셋", "넷"], explanation: "순서 해설" }],
});

// 시드가 작아도 첫 값부터 고르게 퍼지는 난수(mulberry32).
function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("이론 문제 은행은 형식이 맞으면 통과하고 화면에 쓰지 않는 필드는 버린다", () => {
  assert.ok(BANK);
  assert.equal(BANK.type, "theory");
  assert.deepEqual(Object.keys(BANK).sort(), ["explanation", "facts", "sequences", "terms", "title", "type", "units"]);
  // 순서 과정은 없어도 된다.
  const { sequences, ...rest } = BANK;
  assert.deepEqual(cleanGame(rest).sequences, []);
});

test("형식이 틀린 이론 문제 은행은 쓰지 않는다", () => {
  const withTerm = (fields) => ({ ...BANK, terms: [{ ...BANK.terms[0], ...fields }, ...BANK.terms.slice(1)] });
  const bad = [
    { ...BANK, terms: BANK.terms.slice(0, 7) }, // 용어가 너무 적음
    withTerm({ meaning: "가".repeat(23) }), // 뜻이 너무 김
    withTerm({ term: "가".repeat(11) }),
    withTerm({ unit: 3 }), // 없는 단원
    withTerm({ unit: "0" }),
    withTerm({ meaning: BANK.terms[1].meaning }), // 뜻이 겹치면 용어 고르기 답이 둘
    withTerm({ term: BANK.terms[1].term }),
    { ...BANK, units: ["가 단원"] },
    { ...BANK, units: ["가 단원", "가 단원", "다 단원"] },
    { ...BANK, facts: BANK.facts.map((fact) => ({ ...fact, answer: true })) }, // 틀린 문장이 없음
    { ...BANK, facts: BANK.facts.slice(0, 4) },
    { ...BANK, facts: [{ ...BANK.facts[0], explanation: "" }, ...BANK.facts.slice(1)] },
    { ...BANK, sequences: [{ ...BANK.sequences[0], steps: ["하나", "둘", "셋"] }] },
    { ...BANK, sequences: [{ ...BANK.sequences[0], steps: ["하나", "하나", "셋", "넷"] }] },
    { ...BANK, sequences: "순서" },
    { ...BANK, title: "" },
  ];
  for (const bank of bad) assert.equal(cleanGame(bank), null, JSON.stringify(bank).slice(0, 80));
});

// 라운드가 은행의 내용과 맞는지 확인한다.
function checkRound(round) {
  const byTerm = new Map(BANK.terms.map((item) => [item.term, item]));
  if (round.type === "match") {
    assert.equal(round.items.length, 5);
    assert.equal(new Set(round.items.map((item) => item.left)).size, 5);
    for (const item of round.items) assert.equal(byTerm.get(item.left).meaning, item.right);
  } else if (round.type === "pick") {
    assert.equal(round.items.length, 5);
    for (const question of questionsOf(round, seeded(1))) {
      assert.equal(question.options.length, 3);
      assert.equal(new Set(question.options.map((option) => option.label)).size, 3);
      const right = question.options.filter((option) => option.correct);
      assert.equal(right.length, 1);
      assert.equal(byTerm.get(right[0].label).meaning, question.text);
    }
  } else if (round.type === "ox") {
    assert.equal(round.items.length, 5);
    assert.equal(new Set(round.items.map((item) => item.text)).size, 5);
    assert.ok(round.items.some((item) => item.answer) && round.items.some((item) => !item.answer));
  } else if (round.type === "sort") {
    assert.ok(round.categories.length >= 2 && round.categories.length <= 3);
    assert.ok(round.items.length >= 6 && round.items.length <= 8);
    for (const item of round.items) assert.equal(BANK.units[byTerm.get(item.text).unit], round.categories[item.category]);
    round.categories.forEach((_, n) => assert.ok(round.items.filter((item) => item.category === n).length >= 2));
  } else if (round.type === "order") {
    assert.deepEqual(round.items.map((item) => item.text), BANK.sequences[0].steps);
  } else assert.fail(`모르는 라운드 ${round.type}`);
}

test("이론 퀴즈는 매번 서로 다른 유형 3라운드를 은행 내용 그대로 만든다", () => {
  assert.deepEqual(roundTypesOf(BANK), ["match", "pick", "ox", "sort", "order"]);
  const combos = new Set();
  const matchSets = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const rounds = theoryRounds(BANK, seeded(seed));
    assert.equal(rounds.length, ROUNDS);
    assert.equal(new Set(rounds.map((round) => round.type)).size, ROUNDS);
    rounds.forEach(checkRound);
    combos.add(rounds.map((round) => round.type).join());
    const match = rounds.find((round) => round.type === "match");
    if (match) matchSets.add(match.items.map((item) => item.left).sort().join());
  }
  // 유형 조합과 문항이 실행마다 달라진다.
  assert.ok(combos.size >= 20, `유형 조합 ${combos.size}가지`);
  assert.ok(matchSets.size >= 20, `짝 맞추기 문항 조합 ${matchSets.size}가지`);
  assert.ok(Object.keys(roundTitles).every((type) => [...combos].some((combo) => combo.includes(type))));
});

test("한 판 안에서는 짝 맞추기와 용어 고르기에 같은 용어를 다시 내지 않는다", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rounds = theoryRounds(BANK, seeded(seed));
    const match = rounds.find((round) => round.type === "match");
    const pick = rounds.find((round) => round.type === "pick");
    if (!match || !pick) continue;
    const shown = new Set(match.items.map((item) => item.left));
    for (const question of questionsOf(pick, seeded(seed)))
      assert.ok(!shown.has(question.options.find((option) => option.correct).label));
  }
});

test("다시 풀면 직전과 다른 유형 조합을 고른다", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const random = seeded(seed);
    const first = theoryRounds(BANK, random).map((round) => round.type);
    const second = theoryRounds(BANK, random, first).map((round) => round.type);
    assert.notEqual([...second].sort().join(), [...first].sort().join());
  }
});

test("만들 수 없는 유형은 빼고, 남은 유형으로 3라운드를 만든다", () => {
  // 순서 과정이 없고, 한 단원에 용어가 하나뿐이라 분류 칸이 하나만 생기는 은행.
  const bank = {
    ...BANK,
    units: ["가", "나"],
    terms: BANK.terms.slice(0, 8).map((item, n) => ({ ...item, unit: n === 0 ? 0 : 1 })),
    sequences: [],
  };
  assert.deepEqual(roundTypesOf(bank), ["match", "pick", "ox"]);
  // 고를 유형이 3개뿐이면 직전과 같은 조합이어도 만든다.
  for (let seed = 1; seed <= 20; seed++) {
    const rounds = theoryRounds(bank, seeded(seed), ["match", "pick", "ox"]);
    assert.deepEqual(rounds.map((round) => round.type).sort(), ["match", "ox", "pick"]);
  }
  // 칸이 둘이어도 모두 합쳐 6개가 안 되면 분류하기를 만들 수 없다.
  const two = (sizes) => ({ ...bank, terms: BANK.terms.slice(0, 8).map((item, n) => ({ ...item, unit: n < sizes[0] ? 0 : 1 })) });
  assert.ok(roundTypesOf(two([2, 6])).includes("sort"));
  const few = { ...BANK, units: ["가", "나", "다"], terms: BANK.terms.slice(0, 8).map((item, n) => ({ ...item, unit: n < 2 ? 0 : n < 4 ? 1 : 2 })) };
  assert.ok(roundTypesOf(few).includes("sort"));
  for (let seed = 1; seed <= 50; seed++) {
    const sort = theoryRounds(few, seeded(seed)).find((round) => round.type === "sort");
    if (sort) assert.ok(sort.items.length >= 6);
  }
});

test("서비스의 이론 문제 은행은 모두 형식이 맞고 3라운드 이상 고를 유형이 있다", async () => {
  const { readFileSync } = await import("node:fs");
  const lines = readFileSync(new URL("../../backend/data/theory_banks.jsonl", import.meta.url), "utf8").split("\n").filter(Boolean);
  assert.ok(lines.length >= 1);
  for (const line of lines) {
    const raw = JSON.parse(line);
    if (raw.status !== "verified") continue;
    const bank = cleanGame({ ...raw, type: "theory" });
    assert.ok(bank, raw.course_name);
    assert.ok(roundTypesOf(bank).length >= 4, `${raw.course_name}: ${roundTypesOf(bank)}`);
    for (let seed = 1; seed <= 30; seed++) assert.equal(theoryRounds(bank, seeded(seed)).length, ROUNDS);
  }
});

test("분류하기에는 단원 이름만 보고 답이 보이는 용어를 내지 않는다", () => {
  assert.ok(revealsUnit("라플라스 변환", ["일계 방정식", "라플라스 변환"]));
  assert.ok(revealsUnit("부분적분", ["미분", "적분"]));
  assert.ok(revealsUnit("트리", ["논리", "그래프·트리"]));
  assert.ok(!revealsUnit("평균값 정리", ["미분", "적분"]));
  assert.ok(!revealsUnit("명제", ["논리", "그래프·트리"]));
  const bank = {
    ...BANK,
    units: ["라플라스 변환", "푸리에 급수"],
    terms: [
      ...["라플라스 변환", "푸리에 급수"].map((term, unit) => ({ term, meaning: `${unit}번 뜻`, unit })),
      ...BANK.terms.slice(0, 8).map((item, n) => ({ ...item, unit: n % 2 })),
    ],
  };
  for (let seed = 1; seed <= 100; seed++) {
    const sort = theoryRounds(bank, seeded(seed)).find((round) => round.type === "sort");
    if (sort) for (const item of sort.items) assert.ok(!revealsUnit(item.text, sort.categories), item.text);
  }
});
