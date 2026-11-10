import test from "node:test";
import assert from "node:assert/strict";
import { CSP, buildDocument, contrastRatio, insertAt, missionDone, parseColor, scoreOf } from "./logic.js";
import { webPython } from "./data.js";

const { checks, missions, starter } = webPython;

test("데이터: 미션·채점 항목·스니펫의 형식이 맞다", () => {
  const missionIds = missions.map((m) => m.id);
  const fileIds = webPython.files.map((f) => f.id);
  assert.deepEqual(missionIds, ["html", "css", "js"]);
  assert.equal(new Set(checks.map((c) => c.id)).size, checks.length);
  for (const check of checks) assert.ok(missionIds.includes(check.mission), check.id);
  for (const mission of missions) {
    assert.ok(fileIds.includes(mission.file));
    assert.ok(checks.some((c) => c.mission === mission.id && c.core), `${mission.id}에 필수 항목이 있다`);
    for (const snippet of mission.snippets) assert.ok(!snippet.file || fileIds.includes(snippet.file));
  }
  for (const id of fileIds) assert.equal(typeof starter[id], "string");
  assert.ok(webPython.takeaway && webPython.learn && webPython.task && webPython.source);
});

test("미리보기 문서: style.css·script.js를 불러오는 자리에 내용을 넣고, 보안 정책과 검사기는 DOCTYPE 바로 뒤에 둔다", () => {
  const doc = buildDocument({ html: starter.html, css: "h1 { color: red; }", js: 'console.log("hi")' }, "t1", "check");
  assert.match(doc, /^<!DOCTYPE html><meta http-equiv="Content-Security-Policy"/);
  assert.ok(doc.includes(CSP));
  assert.ok(doc.includes("<style>h1 { color: red; }</style>"));
  assert.ok(doc.includes('<script>console.log("hi")</script>'));
  assert.ok(!doc.includes('href="style.css"'));
  assert.ok(!doc.includes('src="script.js"'));
  assert.ok(doc.includes('("t1", "check",'));
  // 외부 스크립트는 정책으로 막힌다(script-src에 주소가 없다).
  assert.ok(!/script-src[^;]*https?:/.test(CSP));
});

test("미리보기 문서: 불러오는 줄을 지우면 실제 브라우저처럼 CSS·JS가 들어가지 않고, 닫는 태그는 깨지지 않게 막는다", () => {
  const html = "<!doctype html><html><head></head><body><h1>제목</h1></body></html>";
  const doc = buildDocument({ html, css: "h1{color:red}", js: "alert(1)" }, "t", "view");
  assert.ok(!doc.includes("h1{color:red}"));
  assert.ok(!doc.includes("alert(1)"));
  const tricky = buildDocument({ html: starter.html, css: "</style><script>x()</script>", js: 'document.write("</script>")' }, "t", "view");
  // <style> 안에서는 </style만 요소를 닫는다(안의 <script>는 그냥 글자다).
  assert.ok(tricky.includes("<style><\\/style><script>x()</script></style>"));
  assert.ok(tricky.includes('document.write("<\\/script>")'));
  // DOCTYPE이 없으면 맨 앞에 둔다.
  assert.match(buildDocument({ html: "<p>hi</p>", css: "", js: "" }, "t", "view"), /^<meta http-equiv/);
});

test("검사기는 문자열로 다시 만들어도 실행할 수 있는 코드다", () => {
  const doc = buildDocument({ html: starter.html, css: "", js: "" }, "tok", "check");
  const source = /<script>(\(function checker[\s\S]*?\);)<\/script>/.exec(doc)?.[1];
  assert.ok(source, "검사기 코드가 들어 있다");
  // 만들기만 하고 실행하지 않는다(문법이 맞는지만 본다).
  assert.doesNotThrow(() => new Function(source));
});

test("채점: 통과한 항목 수 / 전체, 미션은 필수 항목을 모두 통과해야 끝난다", () => {
  const all = Object.fromEntries(checks.map((c) => [c.id, true]));
  assert.deepEqual(scoreOf(checks, all), { correct: checks.length, total: checks.length });
  assert.deepEqual(scoreOf(checks, {}), { correct: 0, total: checks.length });
  assert.deepEqual(scoreOf(checks, null), { correct: 0, total: checks.length });
  const html = { h1: true, p: true, list: true, link: true };
  assert.equal(missionDone(checks, html, "html"), true);
  assert.equal(missionDone(checks, { ...html, link: false }, "html"), false);
  // 완성도 항목(title)은 미션을 막지 않는다.
  assert.equal(missionDone(checks, { ...html, title: false }, "html"), true);
  // 문자열 "true" 같은 값은 통과가 아니다.
  assert.equal(missionDone(checks, { ...html, h1: "true" }, "html"), false);
});

test("색 읽기와 명도 대비(WCAG)", () => {
  assert.deepEqual(parseColor("rgb(255, 0, 0)"), [255, 0, 0, 1]);
  assert.deepEqual(parseColor("rgba(0, 0, 0, 0)"), [0, 0, 0, 0]);
  assert.deepEqual(parseColor("rgb(10 20 30 / 50%)"), [10, 20, 30, 0.5]);
  assert.equal(parseColor("red"), null);
  assert.equal(Math.round(contrastRatio([0, 0, 0], [255, 255, 255])), 21);
  assert.equal(contrastRatio([255, 255, 255], [255, 255, 255]), 1);
  // #767676 on white는 4.5:1을 겨우 넘는 회색으로 알려져 있다.
  assert.ok(contrastRatio([118, 118, 118], [255, 255, 255]) >= 4.5);
  assert.ok(contrastRatio([119, 119, 119], [255, 255, 255]) < 4.5);
});

test("스니펫 넣을 자리: 커서가 있으면 그 자리, 없으면 index.html은 body 안 마지막", () => {
  assert.equal(insertAt("abc", 1, "css"), 1);
  assert.equal(insertAt("abc", null, "css"), 3);
  assert.equal(insertAt("abc", 99, "css"), 3);
  const at = insertAt(starter.html, null, "html");
  assert.ok(starter.html.slice(at).startsWith('  <script src="script.js">'));
  assert.equal(insertAt("<body></body>", null, "html"), 6);
});
