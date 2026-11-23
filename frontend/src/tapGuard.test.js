import { test } from "node:test";
import assert from "node:assert/strict";
import { createTapGuard } from "./tapGuard.js";

const clock = () => {
  let time = 1000;
  return { now: () => time, wait: (ms) => (time += ms) };
};

test("같은 동작을 짧은 시간 안에 다시 부르면 한 번만 동작한다", () => {
  const c = clock();
  const guard = createTapGuard(1000, c.now);
  assert.equal(guard("리포트.txt"), true);
  assert.equal(guard("리포트.txt"), false);
  c.wait(300);
  assert.equal(guard("리포트.txt"), false);
});

test("시간이 지나면 다시 동작한다", () => {
  const c = clock();
  const guard = createTapGuard(1000, c.now);
  assert.equal(guard("a"), true);
  c.wait(999);
  assert.equal(guard("a"), false);
  c.wait(1);
  assert.equal(guard("a"), true);
  // 묶인 요청은 기다리는 시간을 늘리지 않는다: 마지막으로 동작한 때부터 잰다.
  c.wait(500);
  assert.equal(guard("a"), false);
  c.wait(500);
  assert.equal(guard("a"), true);
});

test("다른 동작은 서로 막지 않는다", () => {
  const c = clock();
  const guard = createTapGuard(1000, c.now);
  assert.equal(guard("컴퓨터공학과.txt"), true);
  assert.equal(guard("산업디자인학과.txt"), true);
  assert.equal(guard("컴퓨터공학과.txt"), false);
});

test("만든 함수마다 기록을 따로 가진다", () => {
  const c = clock();
  const first = createTapGuard(1000, c.now);
  const second = createTapGuard(1000, c.now);
  assert.equal(first("a"), true);
  assert.equal(second("a"), true);
});
