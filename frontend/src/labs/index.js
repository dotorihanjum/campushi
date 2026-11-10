// 진짜 수업 체험(실습 랩) 등록부. 과목마다 그 수업에서 실제로 하는 활동을 손으로 해보는 체험을 하나씩 둔다.
// 화면 코드는 과목 모듈(labs/<id>/Lab.jsx)에 있고 components.js가 그 과목에 들어갈 때만 불러온다(첫 화면 번들을 키우지 않는다).
// 이 파일은 React를 쓰지 않아 model.js와 테스트(node)에서도 읽는다.
//
// 공개 규칙: 과제 문구·채점 항목은 AI가 쓰고 쓰지 않은 별도 에이전트의 검토를 통과한 것만 status: "verified"로 등록한다.
//
// since: 이 체험이 생긴 "이수 조건 버전". 필수과목에 체험이 생기면 다음 학년이 열리는 조건이 되는데, 이미 다음 학년이 열린
// 사용자는 다시 잠그지 않는다(2026-11-10 사용자 결정). 저장된 기록의 조건 버전(state.conditions)이 since보다 낮으면
// 그때 이미 열려 있던 학년의 새 조건 과목을 예외(state.exempt)로 남긴다(model.js의 normalize).
import { pythonFunctions } from "./python-functions/data.js";

export const LABS = {
  "khu-cse": {
    "웹/파이선프로그래밍": pythonFunctions,
  },
};

// 지금 이수 조건 버전. 필수과목에 체험을 새로 공개할 때마다 1씩 올리고, 그 체험의 since를 이 값으로 둔다.
export const CONDITIONS = 1;

const verified = (lab) => (lab?.status === "verified" ? lab : null);

/** 그 학과 과목의 체험 데이터(검증을 통과한 것만). 없으면 null. */
export function labOf(departmentId, subject) {
  const byDepartment = Object.hasOwn(LABS, departmentId) ? LABS[departmentId] : null;
  return byDepartment && Object.hasOwn(byDepartment, subject) ? verified(byDepartment[subject]) : null;
}

/** 체험 결과에 남기는 체험 id("lab:<id>")인지. */
export const isLabId = (id) =>
  typeof id === "string" && Object.values(LABS).some((subjects) => Object.values(subjects).some((lab) => verified(lab) && id === `lab:${lab.id}`));
