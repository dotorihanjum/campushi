// 진짜 수업 체험(실습 랩) 등록부. 과목마다 그 수업에서 실제로 하는 활동을 손으로 해보는 체험을 하나씩 둔다.
// 화면 코드는 과목 모듈(labs/<id>/Lab.jsx)에 있고 components.js가 그 과목에 들어갈 때만 불러온다(첫 화면 번들을 키우지 않는다).
// 이 파일은 React를 쓰지 않아 model.js와 테스트(node)에서도 읽는다.
//
// 공개 규칙: 과제 문구·채점 항목은 AI가 쓰고 쓰지 않은 별도 에이전트의 검토를 통과한 것만 status: "verified"로 등록한다.
// 웹/파이선프로그래밍(파이썬 함수 블록)과 자료구조(스택·큐) 체험은 2026-11-12 사용자 결정으로 뺐다(지난 코드는 git 기록에 있다).
//
// since: 이 체험이 생긴 "이수 조건 버전". 필수과목에 체험이 생기면 다음 학년이 열리는 조건이 되는데, 이미 다음 학년이 열린
// 사용자는 다시 잠그지 않는다(2026-11-10 사용자 결정). 저장된 기록의 조건 버전(state.conditions)이 since보다 낮으면
// 그때 이미 열려 있던 학년의 새 조건 과목을 예외(state.exempt)로 남긴다(model.js의 normalize).
export const LABS = {};

// 진짜 수업 체험이 아닌 체험이 다시 생긴 과목과 그 이수 조건 버전. 2026-11-10에 내렸던 이론 퀴즈 15과목을 2026-11-12 사용자 결정으로
// 다시 공개했다(backend/data/theory_banks.jsonl). 그사이 다음 학년이 열린 사용자를 다시 잠그지 않도록 since를 둔다.
export const RESTORED = {
  "khu-cse": Object.fromEntries(
    [
      "이산구조",
      "미분적분학",
      "미분방정식",
      "선형대수",
      "실감미디어컴퓨팅기초",
      "신호와시스템",
      "회로와신호",
      "확률및랜덤변수",
      "컴퓨터구조",
      "논리회로",
      "기계학습",
      "게임프로그래밍입문",
      "풀스택서비스네트워킹",
      "마이크로서비스프로그래밍",
      "오픈소스SW개발방법및도구",
    ].map((subject) => [subject, 3]),
  ),
};

// 지금 이수 조건 버전. 필수과목에 체험을 새로 공개할 때마다 1씩 올리고, 그 체험의 since(또는 RESTORED의 값)를 이 값으로 둔다.
// 1: 웹/파이선 체험, 2: 자료구조 체험(둘 다 2026-11-12에 뺐다), 3: 이론 퀴즈 15과목 다시 공개.
export const CONDITIONS = 3;

const verified = (lab) => (lab?.status === "verified" ? lab : null);

/** 그 학과 과목의 체험 데이터(검증을 통과한 것만). 없으면 null. */
export function labOf(departmentId, subject) {
  const byDepartment = Object.hasOwn(LABS, departmentId) ? LABS[departmentId] : null;
  return byDepartment && Object.hasOwn(byDepartment, subject) ? verified(byDepartment[subject]) : null;
}

/** 이수 조건 버전 from 뒤에 체험이 생긴(또는 다시 생긴) 그 학과의 과목. 체험이 실제로 있는지는 부르는 쪽이 본다. */
export function addedSince(departmentId, from) {
  const labs = Object.entries(Object.hasOwn(LABS, departmentId) ? LABS[departmentId] : {})
    .filter(([, lab]) => lab.since > from)
    .map(([subject]) => subject);
  const restored = Object.entries(Object.hasOwn(RESTORED, departmentId) ? RESTORED[departmentId] : {})
    .filter(([, since]) => since > from)
    .map(([subject]) => subject);
  return [...new Set([...labs, ...restored])];
}

/** 체험 결과에 남기는 체험 id("lab:<id>")인지. */
export const isLabId = (id) =>
  typeof id === "string" && Object.values(LABS).some((subjects) => Object.values(subjects).some((lab) => verified(lab) && id === `lab:${lab.id}`));
