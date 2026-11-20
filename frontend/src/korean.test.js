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

test("괄호로 끝나는 말은 괄호 앞 말에 맞춘다(#72)", () => {
  assert.equal(pick("문제 정의(요구사항 분석)", "을", "를"), "를");
  assert.equal(pick("전류의 합(KCL)", "을", "를"), "을");
  assert.equal(copula("전류의 합(KCL)"), "이에요");
  assert.equal(copula("졸업논문(산업디자인학전공)"), "이에요"); // 문(ㄴ)
  assert.equal(copula("합성함수(f∘g)"), "예요"); // 수
  assert.equal(copula("미분(법칙)."), "이에요"); // 끝 마침표를 건너뛰고 괄호 앞 "미분"
  assert.equal(pick("배열[인덱스]", "은", "는"), "은"); // 열(ㄹ)
  assert.equal(pick("함수(f(x))", "을", "를"), "를"); // 겹친 괄호도 한 묶음
  assert.equal(pick("명제 (조건)(대우)", "은", "는"), "는"); // 괄호 묶음이 여럿이면 거듭 뺀다
  // 짝이 없는 닫는 괄호는 건너뛰고, 말 전체가 괄호면 괄호 안 말로 본다.
  assert.equal(copula("목록 1)"), "이에요");
  assert.equal(copula("(괄호)"), "예요");
  assert.equal(copula("Start()"), "예요");
});

test("서비스 데이터 전체: 괄호로 끝나지 않는 말의 조사는 #67 규칙과 같다", async () => {
  // #67 머지 뒤 규칙(끝의 따옴표·마침표·닫는 괄호를 건너뛰고 남은 마지막 글자).
  const before = (text) => {
    const last = [...String(text).replace(/[\s'"‘’“”.,!?…)\]}>]+$/u, "")].at(-1);
    if (!last) return false;
    const code = last.codePointAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
    const digit = /[0-9]/.test(last) ? Number(last) : "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(last);
    return digit >= 0 ? [true, true, false, true, false, false, true, true, true, false][digit] : false;
  };
  const words = [];
  for (const line of readFileSync(new URL("../../backend/data/theory_banks.jsonl", import.meta.url), "utf8").split("\n").filter(Boolean)) {
    const bank = JSON.parse(line);
    words.push(bank.course_name, bank.title, ...bank.units, ...bank.terms.flatMap((t) => [t.term, t.meaning]));
  }
  const raw = JSON.parse(readFileSync(new URL("../../backend/data/departments.json", import.meta.url), "utf8"));
  for (const d of Array.isArray(raw) ? raw : raw.departments) words.push(d.name, d.school, d.building, ...Object.values(d.years).flat());
  const { CAMPUSES, PLACES } = await import("./campus.js");
  words.push(...CAMPUSES.flatMap((c) => [c.school, c.name]), ...PLACES.map((p) => p.name));
  let changed = 0;
  for (const word of words.filter((w) => typeof w === "string" && w)) {
    if (/[)\]}）][\s'"‘’“”.,!?…>]*$/u.test(word)) {
      changed++;
      continue;
    }
    assert.equal(hasBatchim(word), before(word), word);
  }
  assert.ok(words.length > 500 && changed > 0, `words ${words.length}, 괄호로 끝나는 말 ${changed}`);
});
