import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALL,
  BODY_MAX,
  COMMENT_MAX,
  ME,
  MINE,
  TITLE_MAX,
  addComment,
  addQuestion,
  checkComment,
  checkPost,
  communityStore,
  filterQuestions,
  fromMock,
  timeAgo,
} from "./community.js";
import { MOCK_MENTORS, MOCK_QUESTIONS } from "./communityMock.js";
import { createDepartment } from "./model.js";

const { departments: raw } = JSON.parse(readFileSync(new URL("../../backend/data/departments.json", import.meta.url), "utf8"));
const departments = raw.map(createDepartment);
const NOW = Date.UTC(2026, 10, 9, 12, 0);

test("예시 데이터: 앱에 있는 학과만 쓰고, 질문 8~10개·재학생 5명, 실명·연락처처럼 보이는 내용은 없다", () => {
  const ids = new Set(departments.map((d) => d.id));
  assert.ok(MOCK_QUESTIONS.length >= 8 && MOCK_QUESTIONS.length <= 10);
  assert.equal(MOCK_MENTORS.length, 5);
  for (const item of [...MOCK_QUESTIONS, ...MOCK_MENTORS]) assert.ok(ids.has(item.dept), item.id);
  const text = JSON.stringify([MOCK_QUESTIONS, MOCK_MENTORS]);
  assert.doesNotMatch(text, /\d{2,3}-\d{3,4}-\d{4}|@[\w-]+\.|https?:\/\//);
  assert.equal(new Set([...MOCK_QUESTIONS, ...MOCK_MENTORS].map((x) => x.id)).size, MOCK_QUESTIONS.length + MOCK_MENTORS.length);
});

test("학과 필터: 전체, 내가 체험한 학과(입학한 학과), 학과군, 학과 하나", () => {
  const questions = fromMock(MOCK_QUESTIONS, NOW);
  const count = (filter, journeys) => filterQuestions(questions, filter, departments, journeys).length;
  const cse = questions.filter((q) => q.dept === "khu-cse").length;
  const id = questions.filter((q) => q.dept === "khu-id").length;
  assert.equal(count(ALL), questions.length);
  assert.equal(count(MINE, {}), 0);
  assert.equal(count(MINE, { "khu-id": {} }), id);
  assert.equal(count("computing"), cse);
  assert.equal(count("design"), id);
  assert.equal(count("khu-cse"), cse);
  assert.equal(count("없는학과"), 0);
});

test("글쓰기: 학과·제목·내용을 검사하고, 통과하면 목록 맨 위에 내 글로 붙는다", () => {
  const empty = { dept: "", title: "", body: "" };
  assert.equal(checkPost(empty, departments), "학과를 골라 주세요.");
  assert.equal(checkPost({ ...empty, dept: "khu-cse" }, departments), "제목을 적어 주세요.");
  assert.equal(checkPost({ dept: "khu-cse", title: "   ", body: "내용" }, departments), "제목을 적어 주세요.");
  assert.equal(checkPost({ dept: "khu-cse", title: "제목", body: " " }, departments), "내용을 적어 주세요.");
  assert.match(checkPost({ dept: "khu-cse", title: "가".repeat(TITLE_MAX + 1), body: "내용" }, departments), /60자/);
  assert.match(checkPost({ dept: "khu-cse", title: "제목", body: "가".repeat(BODY_MAX + 1) }, departments), /1,000자/);
  assert.equal(checkPost({ dept: "없는학과", title: "제목", body: "내용" }, departments), "학과를 골라 주세요.");
  assert.equal(checkPost({ dept: "khu-id", title: " 제목 ", body: " 내용 " }, departments), null);

  const before = fromMock(MOCK_QUESTIONS, NOW);
  const after = addQuestion(before, { dept: "khu-id", title: " 실기 준비 어떻게 해요? ", body: " 궁금해요 " }, NOW);
  assert.equal(after.length, before.length + 1);
  assert.deepEqual({ ...after[0], id: "" }, { id: "", dept: "khu-id", author: ME, at: NOW, title: "실기 준비 어떻게 해요?", body: "궁금해요", comments: [] });
  assert.deepEqual(after.slice(1), before);
  // 새 글도 필터에 걸린다.
  assert.equal(filterQuestions(after, "design", departments)[0], after[0]);
  assert.notEqual(addQuestion(before, { dept: "khu-id", title: "a", body: "b" }, NOW)[0].id, after[0].id);
});

test("댓글: 빈 댓글·너무 긴 댓글은 막고, 그 질문에만 붙는다", () => {
  assert.equal(checkComment("  "), "댓글을 적어 주세요.");
  assert.match(checkComment("가".repeat(COMMENT_MAX + 1)), /300자/);
  assert.equal(checkComment("좋은 질문이에요"), null);
  const before = fromMock(MOCK_QUESTIONS, NOW);
  const after = addComment(before, "q4", " 저도 궁금해요 ", NOW);
  const q4 = after.find((q) => q.id === "q4");
  assert.equal(q4.comments.length, 1);
  assert.equal(q4.comments[0].body, "저도 궁금해요");
  assert.equal(q4.comments[0].author, ME);
  assert.deepEqual(after.filter((q) => q.id !== "q4"), before.filter((q) => q.id !== "q4"));
});

test("시간 표시와 메모리 저장소", () => {
  assert.equal(timeAgo(NOW, NOW), "방금 전");
  assert.equal(timeAgo(NOW - 5 * 60000, NOW), "5분 전");
  assert.equal(timeAgo(NOW - 3 * 3600000, NOW), "3시간 전");
  assert.equal(timeAgo(NOW - 2 * 86400000, NOW), "2일 전");
  assert.equal(timeAgo(NOW - 10 * 86400000, NOW), "10월 30일");
  assert.equal(timeAgo(NOW + 60000, NOW), "방금 전");

  const first = communityStore.get();
  assert.equal(communityStore.get(), first);
  let calls = 0;
  const off = communityStore.subscribe(() => calls++);
  communityStore.set(addQuestion(first, { dept: "khu-cse", title: "t", body: "b" }));
  assert.equal(calls, 1);
  assert.equal(communityStore.get().length, first.length + 1);
  off();
  communityStore.set(first);
  assert.equal(calls, 1);
});
