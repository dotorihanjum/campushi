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
  MESSAGE_MAX,
  answeredBy,
  checkMessage,
  communityStore,
  featuredQuestion,
  filterMentors,
  filterQuestions,
  fromMock,
  fromMockThreads,
  hasMentorAnswer,
  lastMessage,
  markRead,
  messageStore,
  recommendMentors,
  searchCommunity,
  sendMessage,
  setBlocked,
  sortThreads,
  timeAgo,
  unreadCount,
} from "./community.js";
import { MOCK_MENTORS, MOCK_QUESTIONS, MOCK_THREADS } from "./communityMock.js";
import { createDepartment } from "./model.js";

const { departments: raw } = JSON.parse(readFileSync(new URL("../../backend/data/departments.json", import.meta.url), "utf8"));
const departments = raw.map(createDepartment);
const NOW = Date.UTC(2026, 10, 9, 12, 0);

test("예시 데이터: 앱에 있는 학과만 쓰고, 질문 8~10개·재학생 5명, 실명·연락처처럼 보이는 내용은 없다", () => {
  const ids = new Set(departments.map((d) => d.id));
  assert.ok(MOCK_QUESTIONS.length >= 8 && MOCK_QUESTIONS.length <= 10);
  assert.equal(MOCK_MENTORS.length, 5);
  for (const item of [...MOCK_QUESTIONS, ...MOCK_MENTORS]) assert.ok(ids.has(item.dept), item.id);
  // 재학생 댓글·예시 쪽지는 있는 재학생·질문만 가리키고, 댓글 이름이 그 재학생 닉네임과 같다.
  const mentors = new Map(MOCK_MENTORS.map((m) => [m.id, m]));
  for (const c of MOCK_QUESTIONS.flatMap((q) => q.comments).filter((c) => c.mentor)) assert.equal(mentors.get(c.mentor)?.nickname, c.author, c.id);
  for (const t of MOCK_THREADS) {
    assert.ok(mentors.has(t.mentor), t.id);
    assert.ok(MOCK_QUESTIONS.some((q) => q.id === t.post), t.id);
    assert.equal(t.messages[0].from, "me", "쪽지는 학생이 먼저 보낸다");
  }
  for (const m of MOCK_MENTORS) assert.ok(m.topics.length > 0 && m.topics.every((x) => x.length === 2), m.id);
  const text = JSON.stringify([MOCK_QUESTIONS, MOCK_MENTORS, MOCK_THREADS]);
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

test("재학생 답변·많이 본 글·추천 선배", () => {
  const questions = fromMock(MOCK_QUESTIONS, NOW);
  const q = (id) => questions.find((x) => x.id === id);
  assert.equal(hasMentorAnswer(q("q1")), true);
  assert.equal(hasMentorAnswer(q("q4")), false);
  assert.deepEqual(answeredBy(questions, "m1").map((x) => x.id), ["q1", "q3"]);
  assert.deepEqual(answeredBy(questions, "m3"), []);

  // 7일 안의 글 중 댓글이 가장 많은 글, 같으면 더 새 글.
  assert.equal(featuredQuestion(questions, NOW).id, "q1");
  const tie = addComment(questions, "q3", "같이 궁금해요", NOW);
  assert.equal(featuredQuestion(tie, NOW).id, "q1", "q1이 q3보다 새 글");
  const more = addComment(tie, "q3", "저도요", NOW);
  assert.equal(featuredQuestion(more, NOW).id, "q3");
  assert.equal(featuredQuestion(questions, NOW + 30 * 86400000), null, "7일이 지나면 없다");
  assert.equal(featuredQuestion(questions.map((x) => ({ ...x, comments: [] })), NOW), null);

  // 필터에 맞는 재학생 중 내가 체험한 학과 먼저, 그다음 답변 수.
  assert.deepEqual(filterMentors(MOCK_MENTORS, "design", departments).map((m) => m.id), ["m2", "m4"]);
  assert.deepEqual(recommendMentors(MOCK_MENTORS, questions, "all", departments).map((m) => m.id), ["m1", "m2", "m4"]);
  assert.deepEqual(recommendMentors(MOCK_MENTORS, questions, "all", departments, { "khu-id": {} }).map((m) => m.id), ["m2", "m4", "m1"]);
  assert.deepEqual(recommendMentors(MOCK_MENTORS, questions, MINE, departments, {}), []);
  assert.equal(recommendMentors(MOCK_MENTORS, questions, "computing", departments, {}, 10).length, 3);
});

test("검색: 띄어쓰기·대소문자 무시, 낱말이 모두 들어간 질문·재학생, 빈 검색어는 결과 없음", () => {
  const questions = fromMock(MOCK_QUESTIONS, NOW);
  const find = (query) => searchCommunity(questions, MOCK_MENTORS, query, departments);
  assert.deepEqual(find("   "), { questions: [], mentors: [] });
  assert.deepEqual(find(""), { questions: [], mentors: [] });
  // 학과 이름으로 찾으면 그 학과 질문과 재학생이 모두 나온다.
  const design = find("산업 디자인");
  assert.deepEqual(design.mentors.map((m) => m.id), ["m2", "m4"]);
  assert.equal(design.questions.length, questions.filter((x) => x.dept === "khu-id").length);
  assert.deepEqual(find("ai").mentors.map((m) => m.id), ["m3"], "대소문자 무시");
  assert.deepEqual(find("정렬 체험").questions.map((x) => x.id), ["q3"]);
  assert.deepEqual(find("포트폴리오").mentors.map((m) => m.id), ["m2"], "주제로도 찾는다");
  assert.deepEqual(find("정렬 포트폴리오"), { questions: [], mentors: [] }, "낱말이 모두 들어가야 한다");
  assert.deepEqual(find("없는말없는말"), { questions: [], mentors: [] });
});

test("쪽지: 학생이 먼저 보내고, 이어 쓰기·읽음·차단", () => {
  assert.equal(checkMessage("  "), "쪽지 내용을 적어 주세요.");
  assert.match(checkMessage("가".repeat(MESSAGE_MAX + 1)), /500자/);
  assert.equal(checkMessage("안녕하세요"), null);

  const threads = fromMockThreads(MOCK_THREADS, NOW);
  assert.equal(unreadCount(threads), 1);
  assert.equal(threads[0].blocked, false);
  assert.equal(lastMessage(threads[0]).from, "mentor");

  // 새 재학생에게 보내면 새 대화가 맨 위에 생긴다.
  const sent = sendMessage(threads, "m1", " 안녕하세요 ", "q1", NOW);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].mentor, "m1");
  assert.equal(sent[0].post, "q1");
  assert.deepEqual({ ...sent[0].messages[0], id: "" }, { id: "", from: "me", at: NOW, body: "안녕하세요" });
  // 있는 대화에는 이어 붙이고, 시작한 글은 바꾸지 않는다.
  const again = sendMessage(sent, "m2", "감사합니다", "q4", NOW + 1000);
  assert.equal(again.length, 2);
  assert.equal(again[0].mentor, "m2");
  assert.equal(again[0].post, "q2");
  assert.equal(again[0].messages.length, 3);
  assert.deepEqual(sortThreads(again).map((t) => t.mentor), ["m2", "m1"]);

  const read = markRead(threads, "t1");
  assert.equal(unreadCount(read), 0);
  assert.deepEqual(markRead(read, "t1"), read, "이미 읽은 대화는 그대로");
  // 차단하면 읽지 않음에 세지 않고 쪽지도 보내지 않는다. 풀면 다시 보낼 수 있다.
  const blocked = setBlocked(threads, "t1", true);
  assert.equal(unreadCount(blocked), 0);
  assert.equal(sendMessage(blocked, "m2", "안녕하세요", null, NOW), blocked);
  assert.equal(sendMessage(setBlocked(blocked, "t1", false), "m2", "안녕하세요", null, NOW)[0].messages.length, 3);

  assert.equal(messageStore.get(), messageStore.get());
  assert.equal(messageStore.get()[0].id, "t1");
});
