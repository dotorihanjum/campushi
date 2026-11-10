import test from "node:test";
import assert from "node:assert/strict";
import { nextOut, run, blocksFor, marksFor } from "./logic.js";
import { stackQueue } from "./data.js";

const [stack, queue] = stackQueue.boxes;

test("데이터: 스택·큐 두 상자와 생활 속 예시, 끝 화면 문장이 있다", () => {
  assert.deepEqual(stackQueue.boxes.map((box) => box.id), ["stack", "queue"]);
  for (const box of stackQueue.boxes) {
    assert.ok(box.rule && box.why && box.name && box.picture);
    assert.ok(box.steps.some((step) => step.take), box.id);
  }
  for (const use of stackQueue.uses) assert.ok(["stack", "queue"].includes(use.answer), use.id);
  // 두 상자의 예시가 모두 있다.
  assert.deepEqual([...new Set(stackQueue.uses.map((use) => use.answer))].sort(), ["queue", "stack"]);
  assert.ok(stackQueue.takeaway.startsWith("이 수업은"));
  assert.ok(stackQueue.link && stackQueue.nameTag && stackQueue.source && stackQueue.learn && stackQueue.task);
  assert.ok(stackQueue.since >= 1);
});

test("스택은 마지막에 넣은 것부터, 큐는 먼저 넣은 것부터 나온다", () => {
  assert.equal(nextOut("stack", ["A", "B", "C"]), "C");
  assert.equal(nextOut("queue", ["A", "B", "C"]), "A");
  assert.equal(nextOut("stack", []), null);
  // 체험의 명령대로 실행해 본다.
  assert.deepEqual(run("stack", stack.steps, 3), { items: ["A", "B", "C"], out: null });
  assert.deepEqual(run("stack", stack.steps, 4), { items: ["A", "B"], out: "C" });
  assert.deepEqual(run("stack", stack.steps, 6), { items: ["A", "B"], out: "D" });
  assert.deepEqual(run("queue", queue.steps, 4), { items: ["B", "C"], out: "A" });
  assert.deepEqual(run("queue", queue.steps, 6), { items: ["C", "D"], out: "B" });
  // 비어 있을 때 꺼내기는 아무것도 하지 않는다.
  assert.deepEqual(run("stack", [{ take: true }], 1), { items: [], out: null });
});

test("생활 속 예시: 같은 이름의 블록이 예시 수만큼 있고, 상자가 맞으면 정답이다", () => {
  const blocks = blocksFor(stackQueue.boxes, stackQueue.uses);
  assert.deepEqual(
    blocks.map((block) => block.id),
    ["stack-1", "stack-2", "queue-1", "queue-2"],
  );
  assert.deepEqual([...new Set(blocks.map((block) => block.label))], ["스택", "큐"]);
  const right = { back: "stack-2", print: "queue-1", undo: "stack-1", ticket: "queue-2" };
  assert.ok(Object.values(marksFor(stackQueue.uses, right)).every(Boolean));
  const wrong = { back: "queue-1", print: "stack-1" };
  assert.deepEqual(marksFor(stackQueue.uses, wrong), { back: false, print: false, undo: false, ticket: false });
});
