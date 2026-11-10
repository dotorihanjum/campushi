import test from "node:test";
import assert from "node:assert/strict";
import { filled, marksOf, place, scoreOf, shuffledBlocks } from "./logic.js";
import { pythonFunctions } from "./data.js";

const { items } = pythonFunctions;

test("데이터: 사용자가 준 예시 다섯 문항과 보기, 힌트·실행 예가 있다", () => {
  assert.deepEqual(
    items.map((item) => [item.text, item.block]),
    [
      ["입력 문자열의 길이 반환", "len()"],
      ["공백을 기준으로 끊어낸 리스트 반환", "split()"],
      ["모든 문자열의 글자 대문자화", "upper()"],
      ["출력", "print()"],
      ["문자열에서 사용된 개수", "count()"],
    ],
  );
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  for (const item of items) assert.ok(item.hint && item.run && item.out, item.id);
  // 실행 예가 그 문항의 함수를 실제로 쓴다.
  for (const item of items) assert.ok(item.run.includes(item.block.replace("()", "(")), item.id);
  assert.ok(pythonFunctions.takeaway.startsWith("이 수업은"));
  assert.ok(pythonFunctions.link && pythonFunctions.nameTag && pythonFunctions.source);
});

test("실행 예의 결과는 파이썬에서 실제로 나오는 값이다", () => {
  const out = Object.fromEntries(items.map((item) => [item.id, item.out]));
  assert.equal(out.len, String("campus hi".length));
  assert.equal(out.split, `[${"I like python".split(" ").map((w) => `'${w}'`).join(", ")}]`);
  assert.equal(out.upper, `'${"hi".toUpperCase()}'`);
  assert.equal(out.print, "안녕");
  assert.equal(out.count, String([..."banana"].filter((c) => c === "a").length));
});

test("보기는 문항 순서와 다르게 섞인다", () => {
  const ids = items.map((item) => item.id);
  for (const seed of [0, 0.3, 0.99]) {
    const order = shuffledBlocks(items, () => seed);
    assert.deepEqual([...order].sort(), [...ids].sort());
    assert.notDeepEqual(order, ids);
  }
  assert.deepEqual(shuffledBlocks([items[0]]), ["len"]);
});

test("블록 넣기·빼기와 채점", () => {
  let value = {};
  assert.equal(filled(items, value), false);
  value = place(value, "len", "len");
  value = place(value, "upper", "split");
  assert.deepEqual(value, { len: "len", split: "upper" });
  // 같은 블록을 다른 빈칸으로 옮기면 원래 빈칸은 빈다.
  value = place(value, "upper", "upper");
  assert.deepEqual(value, { len: "len", upper: "upper" });
  // 채워진 빈칸에 다른 블록을 넣으면 원래 블록은 보기로 돌아간다.
  value = place(value, "count", "upper");
  assert.deepEqual(value, { len: "len", upper: "count" });
  // 빈칸 대신 null이면 보기로 돌려보낸다.
  value = place(value, "count", null);
  assert.deepEqual(value, { len: "len" });
  const wrong = { len: "len", split: "split", upper: "count", print: "print", count: "upper" };
  assert.equal(filled(items, wrong), true);
  assert.deepEqual(marksOf(items, wrong), { len: true, split: true, upper: false, print: true, count: false });
  assert.deepEqual(scoreOf(items, wrong), { correct: 3, total: 5 });
  assert.deepEqual(marksOf(items, {}), { len: false, split: false, upper: false, print: false, count: false });
});
