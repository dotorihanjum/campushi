// 이론 수업 퀴즈: 과목의 문제 은행(lessonGames.js의 theory 형식)에서 체험할 때마다 라운드 3개를 새로 뽑는다.
// 라운드마다 유형이 다르고, 문항도 은행에서 무작위로 고른다. 화면은 TypedGames.jsx의 Theory다.
import { shuffle } from "./lessonGames.js";

export const ROUNDS = 3;
export const roundTitles = {
  match: "짝 맞추기",
  pick: "용어 고르기",
  ox: "OX 퀴즈",
  sort: "분류하기",
  order: "순서 맞추기",
};
const QUESTIONS = 5;
const take = (items, n, random) => shuffle(items, random).slice(0, n);
// 한 판 안에서 앞 라운드에 나온 용어는 되도록 다시 쓰지 않는다(used: 이미 나온 용어). 고른 용어는 used에 더한다.
function fresh(terms, n, random, used) {
  const picked = [...shuffle(terms.filter((item) => !used.has(item.term)), random), ...shuffle(terms.filter((item) => used.has(item.term)), random)].slice(0, n);
  picked.forEach((item) => used.add(item.term));
  return picked;
}

// 단원 이름과 단어가 겹치는 용어(예: 단원 '라플라스 변환'의 용어 '라플라스 변환', 단원 '적분'의 '부분적분')는
// 분류하기 보기만 봐도 답이 보이므로 분류하기에 내지 않는다. 단원 이름은 '·'로 나눈 두 글자 이상의 낱말로 본다.
const squash = (value) => value.replace(/[\s()]/g, "");
export function revealsUnit(term, units) {
  const word = squash(term);
  return units.some((unit) =>
    unit
      .split("·")
      .map(squash)
      .filter((part) => part.length >= 2)
      .some((part) => word.includes(part) || part.includes(word)),
  );
}

// 단원별 용어 묶음(분류하기용). 답이 보이는 용어는 빼고, 한 단원에 용어가 2개 이상이어야 칸이 된다.
const unitGroups = (bank) =>
  bank.units
    .map((name, unit) => ({ name, terms: bank.terms.filter((item) => item.unit === unit && !revealsUnit(item.term, bank.units)) }))
    .filter((group) => group.terms.length >= 2);
const SORT_ITEMS = 6;
const SORT_MAX = 8;

// 이 은행으로 그 유형의 라운드를 만들 수 있는지.
const possible = {
  match: (bank) => bank.terms.length >= 4,
  pick: (bank) => bank.terms.length >= 3,
  ox: (bank) => bank.facts.some((f) => f.answer) && bank.facts.some((f) => !f.answer) && bank.facts.length >= QUESTIONS,
  sort: (bank) => {
    const sizes = unitGroups(bank).map((group) => group.terms.length).sort((a, b) => b - a);
    return sizes.length >= 2 && sizes.slice(0, 3).reduce((a, b) => a + b, 0) >= SORT_ITEMS;
  },
  order: (bank) => bank.sequences.length > 0,
};

const makers = {
  match: (bank, random, used) => ({
    type: "match",
    prompt: "용어와 뜻을 짝지어요.",
    items: fresh(bank.terms, QUESTIONS, random, used).map((item) => ({ left: item.term, right: item.meaning })),
    explanation: "",
  }),
  // 뜻을 보고 용어를 고른다. 오답 보기는 같은 은행의 다른 용어다.
  pick: (bank, random, used) => ({
    type: "pick",
    items: fresh(bank.terms, QUESTIONS, random, used).map((item) => ({
      text: item.meaning,
      choices: [item.term, ...take(bank.terms.filter((other) => other !== item), 2, random).map((other) => other.term)],
      answer: 0,
      explanation: `‘${bank.units[item.unit]}’ 단원에서 배워요.`,
    })),
    explanation: "",
  }),
  // 맞는 문장과 틀린 문장이 모두 하나 이상 들어가게 고른다.
  ox: (bank, random) => {
    const right = shuffle(bank.facts.filter((f) => f.answer), random);
    const wrong = shuffle(bank.facts.filter((f) => !f.answer), random);
    const low = Math.max(1, QUESTIONS - wrong.length);
    const high = Math.min(QUESTIONS - 1, right.length);
    const count = low + Math.floor(random() * (high - low + 1));
    return {
      type: "ox",
      items: shuffle([...right.slice(0, count), ...wrong.slice(0, QUESTIONS - count)], random),
      explanation: "",
    };
  },
  // 단원 2~3개를 골라 용어를 단원별로 나눈다. 칸마다 2개 이상, 모두 6~8개.
  sort: (bank, random) => {
    const groups = shuffle(unitGroups(bank), random);
    let chosen = groups.slice(0, 2);
    const count = (list) => list.reduce((sum, group) => sum + group.terms.length, 0);
    if (count(chosen) < SORT_ITEMS) chosen = groups.slice(0, 3);
    if (count(chosen) < SORT_ITEMS) chosen = [...groups].sort((a, b) => b.terms.length - a.terms.length).slice(0, 3);
    const pools = chosen.map((group) => shuffle(group.terms, random));
    const items = pools.flatMap((pool, category) => pool.slice(0, 2).map((item) => ({ text: item.term, category })));
    const rest = shuffle(
      pools.flatMap((pool, category) => pool.slice(2).map((item) => ({ text: item.term, category }))),
      random,
    );
    const size = Math.min(SORT_MAX, Math.max(SORT_ITEMS, items.length));
    return {
      type: "sort",
      prompt: "용어를 배우는 단원별로 나눠요.",
      categories: chosen.map((group) => group.name),
      items: [...items, ...rest].slice(0, size),
      explanation: "",
    };
  },
  order: (bank, random) => {
    const [sequence] = take(bank.sequences, 1, random);
    return { type: "order", prompt: sequence.prompt, items: sequence.steps.map((text) => ({ text })), explanation: sequence.explanation };
  },
};

// 이 은행으로 만들 수 있는 라운드 유형.
export const roundTypesOf = (bank) => Object.keys(makers).filter((type) => possible[type](bank));

// 라운드 3개를 뽑는다. previous(직전에 푼 유형들)를 주면 되도록 다른 유형 조합을 고른다.
export function theoryRounds(bank, random = Math.random, previous = null) {
  const types = roundTypesOf(bank);
  const key = (list) => [...list].sort().join();
  let chosen = take(types, ROUNDS, random);
  for (let attempt = 0; previous && key(chosen) === key(previous) && attempt < 20; attempt++) chosen = take(types, ROUNDS, random);
  const used = new Set();
  return chosen.map((type) => makers[type](bank, random, used));
}
