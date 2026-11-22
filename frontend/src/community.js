// 커뮤니티 탭(미리보기)의 규칙: 글·댓글·쪽지 만들기와 검사, 학과 필터, 많이 본 글·추천 선배 고르기, 검색, 시간 표시, 메모리 저장소.
// 서버·DB가 없어서 새로 쓴 글·댓글·쪽지는 이 탭을 연 동안 메모리에만 남는다(새로고침하면 사라진다, localStorage도 쓰지 않는다).
import { MOCK_QUESTIONS } from "./communityMock.js";

export const TITLE_MAX = 60;
export const BODY_MAX = 1000;
export const COMMENT_MAX = 300;
export const MESSAGE_MAX = 500;
// 커뮤니티 첫 화면에 보이는 새 글 수와 추천 선배 수. 나머지는 "전체 글 보기"·"선배 더 찾아보기"에서 본다.
export const PREVIEW_COUNT = 4;
export const RECOMMEND_COUNT = 3;
// 댓글이 많은 질문은 최근 이 기간 안의 글에서 고른다.
export const FEATURED_DAYS = 7;
// 내가 쓴 글·댓글에 붙는 이름(계정이 없어서 하나로 쓴다).
export const ME = "나";

// 학과 필터: 전체, 내가 체험한 학과, 학과군(groups.js의 id), 학과 하나(학과 id).
export const ALL = "all";
export const MINE = "mine";

/** 학과 하나(dept)가 필터에 걸리는지. departments: 학과 목록(model.js의 학과, studyGroup 포함), journeys: 입학한 학과 { id: {} }. */
export function inFilter(dept, filter, departments, journeys = {}) {
  if (!filter || filter === ALL) return true;
  if (filter === MINE) return Boolean(journeys[dept]);
  const group = departments.filter((d) => d.studyGroup === filter).map((d) => d.id);
  if (group.length) return group.includes(dept);
  return dept === filter;
}

/** 질문 목록을 필터에 맞게 거른다. */
export const filterQuestions = (questions, filter, departments, journeys = {}) => questions.filter((q) => inFilter(q.dept, filter, departments, journeys));

/** 재학생 목록을 필터에 맞게 거른다. */
export const filterMentors = (mentors, filter, departments, journeys = {}) => mentors.filter((m) => inFilter(m.dept, filter, departments, journeys));

/** 재학생이 댓글을 단 질문인지. */
export const hasMentorAnswer = (question) => question.comments.some((c) => c.mentor);

/** 그 재학생이 댓글을 단 질문들(목록 순서 그대로). */
export const answeredBy = (questions, mentorId) => questions.filter((q) => q.comments.some((c) => c.mentor === mentorId));

/** 최근 FEATURED_DAYS일 안의 글 중 댓글이 가장 많은 글. 같으면 더 새 글. 댓글 달린 글이 없으면 null. */
export function featuredQuestion(questions, now = Date.now()) {
  const since = now - FEATURED_DAYS * 86400000;
  let best = null;
  for (const q of questions) {
    if (q.at < since || !q.comments.length) continue;
    if (!best || q.comments.length > best.comments.length || (q.comments.length === best.comments.length && q.at > best.at)) best = q;
  }
  return best;
}

/**
 * 추천하는 선배: 필터에 맞는 재학생 중 내가 체험한 학과의 선배를 먼저, 그다음 답변을 많이 한 선배 순서로 count명.
 */
export function recommendMentors(mentors, questions, filter, departments, journeys = {}, count = RECOMMEND_COUNT) {
  const answers = (m) => answeredBy(questions, m.id).length;
  return filterMentors(mentors, filter, departments, journeys)
    .map((m, i) => ({ m, i, mine: journeys[m.dept] ? 0 : 1, n: answers(m) }))
    .sort((a, b) => a.mine - b.mine || b.n - a.n || a.i - b.i)
    .slice(0, count)
    .map((x) => x.m);
}

// 검색은 띄어쓰기·대소문자를 무시하고, 검색어를 띄어 쓴 낱말이 모두 들어 있는 것만 찾는다.
const squash = (text) => text.replace(/\s+/g, "").toLowerCase();
const words = (query) => query.split(/\s+/).map(squash).filter(Boolean);
const matches = (fields, ws) => {
  const hay = squash(fields.filter(Boolean).join(" "));
  return ws.every((w) => hay.includes(w));
};

/** 질문(제목·내용·학과 이름)과 재학생(닉네임·소개·학과 이름)을 찾는다. 검색어가 비면 둘 다 빈 목록. */
export function searchCommunity(questions, mentors, query, departments) {
  const ws = words(query || "");
  if (!ws.length) return { questions: [], mentors: [] };
  const deptText = (id) => {
    const d = departments.find((x) => x.id === id);
    return d ? `${d.school || ""} ${d.name}` : "";
  };
  return {
    questions: questions.filter((q) => matches([q.title, q.body, deptText(q.dept)], ws)),
    mentors: mentors.filter((m) => matches([m.nickname, m.intro, deptText(m.dept), ...(m.topics || []).flat()], ws)),
  };
}

/** 글을 검사한다. 문제가 없으면 null, 있으면 사용자에게 보여줄 문장. */
export function checkPost({ dept, title, body }, departments) {
  if (!departments.some((d) => d.id === dept)) return "학과를 골라 주세요.";
  if (!title.trim()) return "제목을 적어 주세요.";
  if (title.trim().length > TITLE_MAX) return `제목은 ${TITLE_MAX}자까지 쓸 수 있어요.`;
  if (!body.trim()) return "내용을 적어 주세요.";
  if (body.trim().length > BODY_MAX) return `내용은 ${BODY_MAX.toLocaleString()}자까지 쓸 수 있어요.`;
  return null;
}

export function checkComment(body) {
  if (!body.trim()) return "댓글을 적어 주세요.";
  if (body.trim().length > COMMENT_MAX) return `댓글은 ${COMMENT_MAX}자까지 쓸 수 있어요.`;
  return null;
}

export function checkMessage(body) {
  if (!body.trim()) return "쪽지 내용을 적어 주세요.";
  if (body.trim().length > MESSAGE_MAX) return `쪽지는 ${MESSAGE_MAX}자까지 쓸 수 있어요.`;
  return null;
}

let seq = 0;
const nextId = (prefix) => `${prefix}-new-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** 예시 글의 "몇 분 전"을 실제 시각으로 바꾼다. */
export const fromMock = (items, now = Date.now()) =>
  items.map(({ minutesAgo, comments, ...rest }) => ({
    ...rest,
    at: now - minutesAgo * 60000,
    ...(comments ? { comments: fromMock(comments, now) } : {}),
  }));

export function addQuestion(questions, { dept, title, body }, now = Date.now()) {
  return [{ id: nextId("q"), dept, author: ME, at: now, title: title.trim(), body: body.trim(), comments: [] }, ...questions];
}

export function addComment(questions, questionId, body, now = Date.now()) {
  return questions.map((q) =>
    q.id === questionId ? { ...q, comments: [...q.comments, { id: nextId("c"), author: ME, at: now, body: body.trim() }] } : q,
  );
}

/**
 * 재학생에게 쪽지를 보낸다. 쪽지는 학생(나)만 먼저 보낼 수 있어서 보내는 사람은 항상 나다.
 * 그 재학생과의 대화가 있으면 이어 붙이고(시작한 글이 없었으면 postId로 채운다), 없으면 새 대화를 만든다. 보낸 대화는 맨 위로 온다.
 * 차단한 재학생에게는 보내지 않는다(그대로 돌려준다).
 */
export function sendMessage(threads, mentorId, body, postId = null, now = Date.now()) {
  const message = { id: nextId("m"), from: "me", at: now, body: body.trim() };
  const found = threads.find((t) => t.mentor === mentorId);
  if (found?.blocked) return threads;
  const thread = found
    ? { ...found, post: found.post || postId, messages: [...found.messages, message] }
    : { id: nextId("t"), mentor: mentorId, post: postId, read: true, blocked: false, messages: [message] };
  return [thread, ...threads.filter((t) => t !== found)];
}

export const lastMessage = (thread) => thread.messages[thread.messages.length - 1];

/** 쪽지함 순서: 마지막 쪽지가 새로운 대화가 위. */
export const sortThreads = (threads) => [...threads].sort((a, b) => lastMessage(b).at - lastMessage(a).at);

/** 읽지 않은 대화 수(차단한 대화는 세지 않는다). */
export const unreadCount = (threads) => threads.filter((t) => !t.read && !t.blocked).length;

export const markRead = (threads, threadId) => threads.map((t) => (t.id === threadId && !t.read ? { ...t, read: true } : t));

export const setBlocked = (threads, threadId, blocked) => threads.map((t) => (t.id === threadId ? { ...t, blocked } : t));

/** "방금 전", "5분 전", "3시간 전", "2일 전", 그보다 오래되면 "11월 2일". */
export function timeAgo(at, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - at) / 60000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))}일 전`;
  const date = new Date(at);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

// 메모리 저장소: 탭을 옮겨 다녀도 쓴 글·쪽지가 남게 화면 밖에 둔다(useSyncExternalStore로 구독).
function memoryStore(load) {
  let value = null;
  const listeners = new Set();
  return {
    get() {
      if (!value) value = load();
      return value;
    },
    set(next) {
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
export const communityStore = memoryStore(() => fromMock(MOCK_QUESTIONS));
// 쪽지함은 비어 있는 채로 시작한다. 학생이 보내지 않은 예시 쪽지를 넣으면 내가 보낸 것처럼 보이고, 미리보기에서는 선배가 답장하지 않는다.
export const messageStore = memoryStore(() => []);
