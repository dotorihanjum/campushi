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
  MENTOR_LABEL,
  communityStore,
  filterMentors,
  filterQuestions,
  fromMock,
  hasMentorAnswer,
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
  // 재학생 댓글은 있는 재학생만 가리키고, 댓글 이름이 그 재학생 닉네임과 같다.
  const mentors = new Map(MOCK_MENTORS.map((m) => [m.id, m]));
  for (const c of MOCK_QUESTIONS.flatMap((q) => q.comments).filter((c) => c.mentor)) assert.equal(mentors.get(c.mentor)?.nickname, c.author, c.id);
  for (const m of MOCK_MENTORS) assert.ok(m.topics.length > 0 && m.topics.every((x) => x.length === 2), m.id);
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
  assert.match(checkPost({ dept: "khu-cse", title: "가".repeat(TITLE_MAX + 1), body: "내용" }, departments), /40자/);
  assert.equal(TITLE_MAX, 40, "manyfast F-DPIKIB·S-GHOVXR의 제목 40자");
  assert.equal(checkPost({ dept: "khu-cse", title: "가".repeat(TITLE_MAX), body: "내용" }, departments), null);
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

test("재학생 답변 표시와 재학생 필터", () => {
  const questions = fromMock(MOCK_QUESTIONS, NOW);
  const q = (id) => questions.find((x) => x.id === id);
  assert.equal(hasMentorAnswer(q("q1")), true);
  assert.equal(hasMentorAnswer(q("q4")), false);
  assert.deepEqual(filterMentors(MOCK_MENTORS, ALL, departments).map((m) => m.id), MOCK_MENTORS.map((m) => m.id), "예시 순서 그대로");
  assert.deepEqual(filterMentors(MOCK_MENTORS, "design", departments).map((m) => m.id), ["m2", "m4"]);
  assert.deepEqual(filterMentors(MOCK_MENTORS, "khu-cse", departments).map((m) => m.id), ["m1", "m3", "m5"]);
  assert.deepEqual(filterMentors(MOCK_MENTORS, MINE, departments, {}), []);
  assert.deepEqual(filterMentors(MOCK_MENTORS, MINE, departments, { "khu-id": {} }).map((m) => m.id), ["m2", "m4"]);
});

test("예시 데이터: 가상 선배는 예시로 표시하고, 제목은 40자 안, 가상 선배가 수업을 겪은 것처럼 말하지 않는다", () => {
  // 승인된 멘토에게만 붙는 '재학생'·'인증' 표시를 예시 선배에게 그대로 쓰지 않는다.
  assert.match(MENTOR_LABEL, /예시/);
  for (const item of MOCK_QUESTIONS) assert.ok(item.title.length <= TITLE_MAX, item.id);
  const said = [...MOCK_QUESTIONS.flatMap((x) => x.comments).filter((c) => c.mentor).map((c) => c.body), ...MOCK_MENTORS.flatMap((m) => [m.intro, ...m.topics.flat()])].join(" ");
  assert.doesNotMatch(said, /수업|학년은|학년 수학|올라갈수록|초반에/);
});
