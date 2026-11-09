// 커뮤니티 탭(미리보기)의 규칙: 글·댓글 만들기와 검사, 학과 필터, 시간 표시, 메모리 저장소.
// 서버·DB가 없어서 새로 쓴 글과 댓글은 이 탭을 연 동안 메모리에만 남는다(새로고침하면 사라진다, localStorage도 쓰지 않는다).
import { MOCK_QUESTIONS } from "./communityMock.js";

export const TITLE_MAX = 60;
export const BODY_MAX = 1000;
export const COMMENT_MAX = 300;
// 내가 쓴 글·댓글에 붙는 이름(계정이 없어서 하나로 쓴다).
export const ME = "나";

// 학과 필터: 전체, 내가 체험한 학과, 학과군(groups.js의 id), 학과 하나(학과 id).
export const ALL = "all";
export const MINE = "mine";

/**
 * 질문 목록을 필터에 맞게 거른다. departments: 학과 목록(model.js의 학과, studyGroup 포함), journeys: 입학한 학과 { id: {} }.
 */
export function filterQuestions(questions, filter, departments, journeys = {}) {
  if (!filter || filter === ALL) return questions;
  if (filter === MINE) return questions.filter((q) => journeys[q.dept]);
  const group = departments.filter((d) => d.studyGroup === filter).map((d) => d.id);
  if (group.length) return questions.filter((q) => group.includes(q.dept));
  return questions.filter((q) => q.dept === filter);
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

// 메모리 저장소: 탭을 옮겨 다녀도 쓴 글이 남게 화면 밖에 둔다(useSyncExternalStore로 구독).
let questions = null;
const listeners = new Set();
export const communityStore = {
  get() {
    if (!questions) questions = fromMock(MOCK_QUESTIONS);
    return questions;
  },
  set(next) {
    questions = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
