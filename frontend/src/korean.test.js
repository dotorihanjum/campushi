import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { copula, hasBatchim, pick } from "./korean.js";

test("받침: 한글은 끝 글자, 숫자는 읽는 소리, 끝의 따옴표·마침표·닫는 괄호는 건너뛴다", () => {
  assert.equal(copula("명제"), "예요");
  assert.equal(copula("법칙"), "이에요");
  // 숫자: 영·일·삼·육·칠·팔은 받침이 있고 이·사·오·구는 없다. 0으로 끝나면 십·백·천도 모두 받침이 있다.
  assert.deepEqual([..."0123456789"].map(hasBatchim), [true, true, false, true, false, false, true, true, true, false]);
  assert.equal(copula("전류의 합은 0"), "이에요");
  assert.equal(copula("det(A−λI)=0"), "이에요");
  assert.equal(copula("10"), "이에요");
  assert.equal(copula("25"), "예요");
  assert.equal(copula("x²"), "예요");
  assert.equal(copula("x³"), "이에요");
  // 끝의 따옴표·마침표·괄호
  assert.equal(copula("'모든'·'어떤'"), "이에요"); // 떤(ㄴ 받침)
  assert.equal(copula("'p이면 q'"), "예요");
  assert.equal(copula("기호 '법칙'"), "이에요");
  assert.equal(copula("미분(법칙)."), "이에요");
  // 영문·기호·빈 값은 받침이 없는 것으로 본다(지금과 같다).
  assert.equal(copula("TCP"), "예요");
  assert.equal(copula("Start()"), "예요");
  assert.equal(copula(""), "예요");
  assert.equal(copula(undefined), "예요");
  assert.equal(pick("국제캠퍼스", "은", "는"), "는");
  assert.equal(pick("컴퓨터공학과", "을", "를"), "를");
  assert.equal(pick("서울캠퍼스 준비 중인 전공", "을", "를"), "을");
});

test("조사(받침) 고르기는 korean.js 한 곳에만 있다", () => {
  const src = fileURLToPath(new URL(".", import.meta.url));
  const files = readdirSync(src, { recursive: true }).filter((file) => /\.(js|jsx)$/.test(file) && !/\.test\.js$/.test(file) && file !== "korean.js");
  for (const file of files) assert.doesNotMatch(readFileSync(`${src}/${file}`, "utf8"), /0xac00|0xAC00|44032/, `${file}에 받침 계산이 따로 있다`);
});
