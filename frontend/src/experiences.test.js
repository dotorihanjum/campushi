import test from "node:test";
import assert from "node:assert/strict";
import {
  checkPicks,
  cleanExperience,
  experienceTitle,
  experiences,
  inversions,
  isSorted,
  makeTrials,
  predict,
  startOrder,
  summarizeReaction,
  templates,
  trainStump,
  SORT_GUIDE_START,
  SORT_KINDS,
  SORT_ROUNDS,
  sortPick,
  sortRoundKinds,
  sortStart,
  sortSwaps,
} from "./experiences.js";
import { createDepartment } from "./model.js";
import { groupData } from "./groupData.js";
import { RAW_CSE, RAW_ID } from "./testFixtures.js";

// 반응 실험(틀 D) 형식 검사용 예시. 이 서비스의 학과군은 쓰지 않는 틀이라 테스트 안에 둔다.
const REACTION = {
  template: "D",
  title: "반응 시간 실험",
  task: "신호가 하나일 때와 여럿일 때의 반응 속도를 비교해요.",
  learn: "고를 수 있는 경우가 많아질수록 반응이 느려지는데, 이것을 힉의 법칙이라고 해요.",
  generator: "hick",
  pairs: 8,
  choices: [
    { id: "red", label: "빨강", color: "#ff6b61" },
    { id: "blue", label: "파랑", color: "#5aa9ff" },
    { id: "green", label: "초록", color: "#44d68a" },
    { id: "yellow", label: "노랑", color: "#ffd84d" },
  ],
  conditions: ["신호가 하나일 때", "신호가 넷일 때"],
  prompt: "가운데에 나온 동그라미의 색을 최대한 빨리 골라요.",
  notice: "색을 구분하기 어려우면 정확한 결과가 나오지 않을 수 있어요.",
  effect: "고를 수 있는 경우가 많아질수록 반응이 느려지기 때문이에요.",
  noEffect: "문제 수가 적으면 결과가 달라질 수 있어요.",
  tooFew: "맞힌 문제가 부족해 반응 시간을 비교할 수 없어요. 다시 해보세요.",
  footnote: "힉-하이먼 법칙이라고도 해요.",
};

// 테스트가 매번 같은 결과를 내도록 고정된 난수를 쓴다.
function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

test("지금 쓰는 체험 데이터는 모두 형식 검사를 통과한다", () => {
  for (const [id, data] of Object.entries(experiences)) assert.ok(data, `${id} 형식이 틀림`);
  assert.deepEqual(
    Object.fromEntries(Object.entries(experiences).map(([id, data]) => [id, data.template])),
    { sorting: "B", journal: "C", artwork: "A", capstone: "F", petClassifier: "G", thesis: "F", showcase: "F" },
  );
  // 졸업 과제와, 학과군 데이터가 바탕으로 쓰는 체험은 모두 데이터가 있다.
  for (const group of Object.values(groupData))
    for (const entry of [group.practice, group.final]) if (entry.base) assert.ok(experiences[entry.base], entry.base);
  assert.ok(Object.keys(templates).length <= 6);
});

test("형식이 틀린 체험 데이터는 거른다", () => {
  const base = experiences.sorting;
  assert.equal(cleanExperience(null), null);
  assert.equal(cleanExperience({ ...base, template: "Z" }), null);
  assert.equal(cleanExperience({ ...base, title: "" }), null);
  assert.equal(cleanExperience({ ...base, title: "가".repeat(21) }), null);
  assert.equal(cleanExperience({ ...base, task: undefined }), null);
  // B: 단계 수, 중복, 정렬 고르기일 때 카드 글자 수
  assert.equal(cleanExperience({ ...base, items: ["1", "2", "3"] }), null);
  assert.equal(cleanExperience({ ...base, items: ["1", "1", "3", "4"] }), null);
  assert.equal(cleanExperience({ ...base, items: ["가나다라마", "2", "3", "4"] }), null);
  assert.ok(cleanExperience({ ...base, swap: "move", items: ["가나다라마", "2", "3", "4"] }));
  assert.equal(cleanExperience({ ...base, swap: "jump" }), null);
  // 예전 버블 정렬 따라 하기(adjacent)는 없어졌다(#89).
  assert.equal(cleanExperience({ ...base, swap: "adjacent" }), null);
  // 정렬 고르기는 버블·선택·삽입 세 정렬의 이름과 방법이 모두 있어야 한다.
  assert.equal(cleanExperience({ ...base, sorts: undefined }), null);
  assert.equal(cleanExperience({ ...base, sorts: base.sorts.slice(0, 2) }), null);
  assert.equal(cleanExperience({ ...base, sorts: [base.sorts[0], base.sorts[0], base.sorts[2]] }), null);
  assert.equal(cleanExperience({ ...base, sorts: [{ ...base.sorts[0], id: "quick" }, ...base.sorts.slice(1)] }), null);
  assert.equal(cleanExperience({ ...base, sorts: [{ ...base.sorts[0], rule: "" }, ...base.sorts.slice(1)] }), null);
  // 자리 옮기기에는 정렬 방법이 붙지 않는다.
  assert.equal(cleanExperience({ ...base, swap: "move" }).sorts, undefined);
  // C: 정답이 보기에 없거나 칸 수와 다르면 안 된다.
  const journal = experiences.journal;
  assert.equal(cleanExperience({ ...journal, items: [{ ...journal.items[0], answer: ["cash"] }, ...journal.items.slice(1)] }), null);
  assert.equal(cleanExperience({ ...journal, items: [{ ...journal.items[0], answer: ["cash", "nope"] }, ...journal.items.slice(1)] }), null);
  assert.equal(cleanExperience({ ...journal, slots: [] }), null);
  // D: 색은 #rrggbb, 만드는 방식은 정해진 것만
  const reaction = REACTION;
  assert.ok(cleanExperience(reaction));
  assert.equal(cleanExperience({ ...reaction, choices: [{ ...reaction.choices[0], color: "red" }, ...reaction.choices.slice(1)] }), null);
  assert.equal(cleanExperience({ ...reaction, generator: "stroop" }), null);
  assert.equal(cleanExperience({ ...reaction, pairs: 2 }), null);
  // 알아두기(learn)는 없어도 되지만, 있으면 120자까지다.
  assert.equal(cleanExperience({ ...base, learn: "" }).learn, "");
  assert.equal(cleanExperience({ ...base, learn: "가".repeat(121) }), null);
  // A: 장면은 있는 그림만
  assert.equal(cleanExperience({ ...experiences.artwork, phases: [{ label: "칠하기", scene: "none", particles: "paint" }] }), null);
  // F: 계획서는 세 칸
  const plan = experiences.thesis;
  assert.equal(cleanExperience({ ...plan, prompts: plan.prompts.slice(0, 2) }), null);
  assert.equal(cleanExperience({ ...plan, prompts: [{ ...plan.prompts[0], options: ["하나"] }, ...plan.prompts.slice(1)] }), null);
});

test("순서 맞추기: 역순 쌍과 시작 순서", () => {
  assert.equal(inversions([0, 1, 2]), 0);
  assert.equal(inversions([2, 1, 0]), 3);
  assert.equal(inversions([1, 0, 3, 2]), 2);
  // 정렬 고르기는 너무 쉬운 배치를 피한다(역순 쌍이 최대의 40% 이상).
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const order = startOrder(6, "pick", seeded(seed));
    assert.deepEqual([...order].sort(), [0, 1, 2, 3, 4, 5]);
    assert.ok(inversions(order) >= 6);
  }
  // 자리 옮기기는 이미 맞춰진 순서로 시작하지 않는다.
  for (const seed of [1, 2, 3, 4, 5]) assert.ok(!isSorted(startOrder(4, "move", seeded(seed))));
});

test("분류하기: 분개 문제는 차변과 대변이 회계 원칙에 맞는다", () => {
  const data = experiences.journal;
  const [debit] = data.slots;
  const kind = (id) => debit.options.find((option) => option.id === id).label.match(/\((.+)\)/)[1];
  const name = (id) => debit.options.find((option) => option.id === id).label.split(" ")[0];
  assert.equal(data.items.length, 5);
  for (const item of data.items) {
    const [d, c] = item.answer;
    assert.notEqual(d, c);
    assert.ok(checkPicks(item, [d, c]));
    assert.ok(!checkPicks(item, [c, d]));
    assert.ok(!checkPicks(item, [d, ""]));
    assert.ok(item.why.includes(name(d)) && item.why.includes(name(c)));
  }
  assert.deepEqual(
    data.items.map((item) => item.answer.map(kind)),
    [
      ["자산", "자본"],
      ["자산", "부채"],
      ["자산", "부채"],
      ["비용", "자산"],
      ["부채", "자산"],
    ],
  );
});

test("반응 실험: 힉 실험은 신호 하나인 묶음 뒤에 신호 넷인 묶음이 온다", () => {
  const data = cleanExperience(REACTION);
  for (const seed of [1, 2, 3, 4, 5]) {
    const trials = makeTrials(data, seeded(seed));
    assert.equal(trials.length, 16);
    // 앞 8문제는 늘 첫 번째 색, 뒤 8문제는 네 색이 두 번씩 섞여 나온다.
    assert.ok(trials.slice(0, 8).every((t) => t.condition === 0 && t.answer === data.choices[0].id));
    const many = trials.slice(8);
    assert.ok(many.every((t) => t.condition === 1));
    for (const choice of data.choices) assert.equal(many.filter((t) => t.answer === choice.id).length, 2);
    for (const t of trials) assert.equal(t.color, data.choices.find((choice) => choice.id === t.answer).color);
  }
});
test("반응 실험 결과는 맞힌 시행의 평균 시간으로 두 조건을 비교한다", () => {
  assert.deepEqual(
    summarizeReaction([
      { condition: 0, correct: true, ms: 500 },
      { condition: 0, correct: true, ms: 700 },
      { condition: 0, correct: false, ms: 9000 },
      { condition: 1, correct: true, ms: 900 },
      { condition: 1, correct: true, ms: 1100 },
    ]),
    { correct: 4, total: 5, means: [600, 1000], difference: 400 },
  );
  const none = summarizeReaction([{ condition: 0, correct: false, ms: 300 }]);
  assert.deepEqual(none.means, [null, null]);
  assert.equal(none.difference, null);
});

test("졸업 계획서는 칸마다 고를 수 있는 보기가 있다", () => {
  for (const id of ["capstone", "thesis", "showcase"]) {
    const final = experiences[id];
    assert.equal(final.prompts.length, 3);
    for (const prompt of final.prompts) assert.ok(prompt.options.length >= 2);
  }
});

test("AI 가르치기: 사용자가 붙인 이름표로 실제로 학습하고, 결과는 미리 정해 두지 않는다", () => {
  const data = experiences.petClassifier;
  const teach = (labels) => trainStump(data, data.train.map((card, i) => ({ picture: card.picture, label: labels[i] })));
  const passes = (model) => data.test.every((card) => predict(model, card.picture).label === card.answer);
  const right = data.train.map((card) => card.answer);
  // 맞게 가르치면 귀 모양을 배우고 시험을 다 맞히지만, 머리띠를 한 강아지는 고양이라고 한다(확신도는 계산값).
  const model = teach(right);
  assert.equal(model.feature, "ears");
  assert.ok(passes(model));
  assert.deepEqual(predict(model, data.surprise.picture), { label: "cat", confidence: 80 });
  // 귀 모양만 학습 사진을 완벽하게 나눈다. 주둥이나 털 색을 배운 AI는 시험에서 틀린다.
  for (const feature of ["nose", "fur"]) {
    const rule = (value) => {
      const same = data.train.filter((card) => card.picture[feature] === value);
      const cats = same.filter((card) => card.answer === "cat").length;
      return cats * 2 >= same.length ? "cat" : "dog";
    };
    const forced = { feature, rule: Object.fromEntries(data.features.find((f) => f.id === feature).values.map((v) => [v.id, rule(v.id)])), counts: Object.fromEntries(data.features.find((f) => f.id === feature).values.map((v) => [v.id, { total: 1, hits: 1 }])) };
    assert.ok(!passes(forced), feature);
  }
  // 두 장을 잘못 가르치면 주둥이를 배워 시험에서 틀린다. 모두 반대로 가르치면 하나도 못 맞힌다.
  const twoWrong = teach(["cat", "dog", "dog", "dog", "cat", "cat"]);
  assert.equal(twoWrong.feature, "nose");
  assert.ok(!passes(twoWrong));
  const flipped = teach(right.map((label) => (label === "cat" ? "dog" : "cat")));
  assert.equal(data.test.filter((card) => predict(flipped, card.picture).label === card.answer).length, 0);
  // 한 장만 잘못 가르치면 확신도가 낮아진다(3장 중 2장이 고양이 → (2+1)/(3+2)).
  assert.equal(predict(teach(["cat", "dog", "dog", "dog", "cat", "dog"]), data.surprise.picture).confidence, 60);
});
test("AI 가르치기 데이터는 형식이 맞는 것만 받는다", () => {
  const base = { ...experiences.petClassifier, caption: experiences.petClassifier.surprise.caption };
  assert.ok(cleanExperience(base));
  const broken = [
    { ...base, labels: [base.labels[0]] },
    { ...base, train: base.train.slice(0, 3) },
    { ...base, test: [{ picture: { ears: "pointy", nose: "small" }, answer: "cat" }, ...base.test] },
    { ...base, surprise: { ...base.surprise, answer: "bird" } },
    { ...base, reviews: { ...base.reviews, wrong: { text: "별로", stars: 0 } } },
    { ...base, features: [base.features[0], { ...base.features[1], values: [base.features[1].values[0]] }] },
    { ...base, test: [{ picture: { ...base.test[0].picture, look: "hat" }, answer: "dog" }, ...base.test.slice(1)] },
  ];
  for (const raw of broken) assert.equal(cleanExperience(raw), null);
  // 검사를 통과한 데이터를 다시 검사해도 같다(학과군 데이터가 base로 쓸 때).
  assert.deepEqual(cleanExperience(experiences.petClassifier), experiences.petClassifier);
});
test("졸업 과제는 틀에 따라 프로젝트(점수) 또는 작품(P)이다", () => {
  assert.equal(createDepartment(RAW_CSE).final.kind, "project");
  assert.equal(createDepartment(RAW_ID).final.kind, "artwork");
});

// 고른 대로 바꿔 끝까지 정렬한다(맞는 교환만 고른다).
function solve(order, kind) {
  let state = sortStart(order, kind);
  while (!state.done) {
    const [i, j] = state.steps[state.at];
    state = sortPick(state, j, i).state; // 고르는 순서는 상관없다
  }
  return state;
}

test("정렬 고르기: 세 정렬이 실제로 바꾸는 순서", () => {
  // [4, 1, 6, 3]을 정렬하는 교환(자리 번호).
  const start = [2, 0, 3, 1];
  assert.deepEqual(sortSwaps(start, "bubble"), [[0, 1], [2, 3], [1, 2]]);
  assert.deepEqual(sortSwaps(start, "selection"), [[0, 1], [1, 3], [2, 3]]);
  assert.deepEqual(sortSwaps(start, "insertion"), [[0, 1], [2, 3], [1, 2]]);
  // 버블: 1바퀴에 (0,1) 다음 (1,2)는 4<6이라 안 바꾸고 (2,3)을 바꾼다. 삽입: 6은 이미 제자리라 건너뛰고, 3을 두 칸 옮긴다.
  assert.deepEqual(sortSwaps([0, 1, 2, 3], "selection"), []);
  for (let seed = 1; seed <= 200; seed++) {
    const order = startOrder(6, "pick", seeded(seed));
    for (const kind of SORT_KINDS) {
      const steps = sortSwaps(order, kind);
      // 끝까지 바꾸면 정렬된다. 버블·삽입은 이웃끼리만, 정확히 역순 쌍 수만큼 바꾸고, 선택은 많아야 카드 수 - 1번 바꾼다.
      assert.deepEqual(solve(order, kind).order, [0, 1, 2, 3, 4, 5]);
      if (kind === "selection") assert.ok(steps.length >= 1 && steps.length <= 5);
      else {
        assert.equal(steps.length, inversions(order));
        assert.ok(steps.every(([i, j]) => j === i + 1));
      }
    }
  }
});

test("정렬 고르기: 맞는 교환만 카드가 움직이고, 틀리면 실수로 세며 카드는 그대로다", () => {
  for (const kind of SORT_KINDS) {
    let state = sortStart([5, 1, 4, 0, 3, 2], kind);
    const [i, j] = state.steps[0];
    // 다른 두 카드: 실수 1번, 카드·진행은 그대로.
    const wrong = [0, 1, 2, 3, 4, 5].flatMap((a) => [0, 1, 2, 3, 4, 5].map((b) => [a, b])).find(([a, b]) => a < b && !(a === i && b === j));
    const missed = sortPick(state, ...wrong);
    assert.equal(missed.ok, false);
    assert.equal(missed.counted, true);
    assert.deepEqual(missed.state.order, state.order);
    assert.equal(missed.state.at, 0);
    assert.equal(missed.state.mistakes, 1);
    // 같은 카드를 두 번 고르거나 없는 자리는 실수로 세지 않는다.
    for (const [a, b] of [[i, i], [-1, j], [i, 6]]) {
      const ignored = sortPick(missed.state, a, b);
      assert.equal(ignored.counted, false);
      assert.equal(ignored.state, missed.state);
    }
    // 맞는 교환: 두 카드가 자리를 바꾼다.
    state = sortPick(missed.state, i, j).state;
    assert.equal(state.correct, 1);
    assert.equal(state.order[i], missed.state.order[j]);
    assert.equal(state.order[j], missed.state.order[i]);
    // 끝까지 하면 done이고, 그 뒤에는 아무것도 바뀌지 않는다.
    while (!state.done) state = sortPick(state, ...state.steps[state.at]).state;
    assert.deepEqual(state.order, [0, 1, 2, 3, 4, 5]);
    assert.equal(state.mistakes, 1);
    assert.equal(sortPick(state, 0, 1).counted, false);
  }
});

test("정렬 고르기: 선택 정렬에서 가장 작은 수가 이미 맨 앞이면 누르지 않아도 다음 교환으로 간다", () => {
  // 0이 이미 맨 앞, 1도 이미 둘째 자리라 첫 교환은 셋째 칸(2)과 가장 작은 남은 수(자리 4)다.
  const state = sortStart([0, 1, 5, 4, 2, 3], "selection");
  assert.deepEqual(state.steps[0], [2, 4]);
  assert.equal(sortPick(state, 0, 1).ok, false);
  assert.equal(sortPick(state, 2, 4).ok, true);
  // 이미 정렬된 카드로 시작하면 바로 끝난 라운드다.
  assert.equal(sortStart([0, 1, 2, 3], "insertion").done, true);
});

test("정렬 고르기: 5라운드는 버블 → 선택 → 삽입 → 무작위 → 무작위", () => {
  assert.equal(SORT_ROUNDS, 5);
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const kinds = sortRoundKinds(seeded(seed));
    assert.equal(kinds.length, 5);
    assert.deepEqual(kinds.slice(0, 3), ["bubble", "selection", "insertion"]);
    for (const kind of kinds.slice(3)) {
      assert.ok(SORT_KINDS.includes(kind));
      seen.add(kind);
    }
  }
  // 무작위 라운드에는 세 정렬이 모두 나온다.
  assert.equal(seen.size, 3);
  // 난수가 1에 가까워도 범위를 넘지 않는다.
  assert.deepEqual(sortRoundKinds(() => 0.9999999).slice(3), ["insertion", "insertion"]);
  // 시작 배치는 어느 정렬이든 바꿀 것이 있다.
  for (let seed = 1; seed <= 50; seed++) for (const kind of SORT_KINDS) assert.equal(sortStart(startOrder(6, "pick", seeded(seed)), kind).done, false);
});

test("배우기 예시: 세 정렬의 교환 순서가 서로 달라 방법의 차이가 보인다(#90)", () => {
  // 3·4·1·2번째로 작은 카드로 시작한다.
  assert.deepEqual(SORT_GUIDE_START, [2, 3, 0, 1]);
  // 카드 크기(번호)로 본 교환: 버블은 옆 칸끼리 바퀴마다, 삽입은 카드 하나씩 왼쪽으로, 선택은 남은 최솟값을 앞으로.
  const swapped = (kind) => {
    let order = [...SORT_GUIDE_START];
    return sortSwaps(SORT_GUIDE_START, kind).map(([i, j]) => {
      const pair = [order[i], order[j]];
      [order[i], order[j]] = [order[j], order[i]];
      return pair;
    });
  };
  assert.deepEqual(swapped("bubble"), [[3, 0], [3, 1], [2, 0], [2, 1]]);
  assert.deepEqual(swapped("insertion"), [[3, 0], [2, 0], [3, 1], [2, 1]]);
  assert.deepEqual(swapped("selection"), [[2, 0], [3, 1]]);
  const seqs = SORT_KINDS.map((kind) => JSON.stringify(swapped(kind)));
  assert.equal(new Set(seqs).size, 3);
});

test("체험 이름: 정렬 고르기는 '정렬', 다른 체험은 틀 이름 그대로다(#92)", () => {
  assert.equal(experienceTitle(experiences.sorting), "정렬");
  // 같은 순서 맞추기 틀이라도 자리 옮기기(디자인 과정 등)는 "순서 맞추기"다.
  assert.equal(experienceTitle(cleanExperience({ ...experiences.sorting, swap: "move" })), "순서 맞추기");
  assert.equal(experienceTitle(experiences.journal), "분류하기");
  assert.equal(experienceTitle(experiences.petClassifier), "AI 가르치기");
  assert.equal(experienceTitle(null), "");
});
