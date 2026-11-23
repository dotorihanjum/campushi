// 진짜 수업 체험(실습 랩) 등록부. 과목마다 그 수업에서 실제로 하는 활동을 손으로 해보는 체험을 하나씩 둔다.
// 화면 코드는 과목 모듈(labs/<id>/Lab.jsx)에 있고 components.js가 그 과목에 들어갈 때만 불러온다(첫 화면 번들을 키우지 않는다).
// 이 파일은 React를 쓰지 않아 model.js와 테스트(node)에서도 읽는다.
//
// 어느 과목에 어떤 체험이 있고 공개했는지(id·status·since)는 backend/data/record_conditions.json의 labs 한 곳에만 둔다(#103).
// 서버도 같은 파일을 읽어 verified 체험의 이수만 받으므로, 화면과 서버가 같은 체험을 공개한다. 형식:
//   "labs": { "<학과 id>": { "<과목>": { "id": "kebab-case", "status": "verified" | "draft", "since": 이수 조건 버전 } } }
// 체험 문구(title·task·source·learn·takeaway)는 과목 모듈의 데이터(labs/<id>/data.js)에 두고 아래 LAB_DATA에 id로 붙인다.
//
// 공개 순서(QA 재현 규칙):
//   1. 검토 전에는 status: "draft"로 넣고 version은 올리지 않는다(since는 지금 version 이하).
//   2. 별도 에이전트 검토를 통과해 verified로 바꾸는 커밋에서 version을 1 올리고, 그 체험의 since를 그 값으로 둔다.
//      필수과목에 체험이 생기면 다음 학년이 열리는 조건이 되므로, since로 그때 이미 열려 있던 학년을 다시 잠그지 않는다(아래 since 설명).
// 공개 규칙: 과제 문구·채점 항목은 AI가 쓰고 쓰지 않은 별도 에이전트의 검토를 통과한 것만 status: "verified"로 등록한다.
// 웹/파이선프로그래밍(파이썬 함수 블록)과 자료구조(스택·큐) 체험은 2026-11-12 사용자 결정으로 뺐다(지난 코드는 git 기록에 있다).
//
// 체험 하나의 형식(등록부 + 문구를 합친 것. labProblems가 검사한다. 형식이 틀리면 verified여도 공개하지 않고, 테스트가 실패한다):
//   { id: "kebab-case", status: "verified" | "draft", since: 이수 조건 버전, title, task, source(근거 한 줄), learn?(배우기 단계 설명),
//     takeaway: { summary: "이 수업은 ○○를 하는 수업이에요" 한 문장, highSchool: 고등학교 내용과의 연결,
//                 terms: [{ name: 대학 용어, meaning: 방금 해본 것으로 풀어 쓴 뜻 }] } }
// takeaway는 마지막 라운드를 끝낸 직후 직접 해보기 단계 안의 요약(labs/parts/LabSummary.jsx)과 기록 단계의 "배운 내용"에 쓴다.
//
// 실습 화면 작성 규칙(#63): 마지막 라운드를 맞히면 바로 onComplete를 부르고, 그 결과(맞았어요·실행 결과)는 화면에 남겨 둔다.
// 그 뒤 "결과 보기"(요약으로)와 "체험 다시 해보기"는 공통 틀(screens/Lesson.jsx, LabSummary)이 맡으므로, 마지막 라운드 뒤에
// 자체 "결과 보기"·재시작 버튼을 두지 않는다(두면 onComplete가 다시 불려 저장된 결과가 덮일 수 있다).
//
// 검증 기록(check: 검토자, 검토 시각, 뺀 항목과 이유)은 학생 화면과 번들에 넣지 않으려고 checks.js에 따로 두고 테스트만 읽는다.
// 이 파일에는 검증 기록이 있는 체험 id(CHECKED)만 둔다. CHECKED에 없는 체험은 verified여도 공개하지 않고,
// CHECKED와 checks.js가 어긋나면(기록이 없거나 형식이 틀린 id가 있으면) 테스트가 실패한다(labs.test.js).
//
// since: 이 체험이 생긴 "이수 조건 버전". 필수과목에 체험이 생기면 다음 학년이 열리는 조건이 되는데, 이미 다음 학년이 열린
// 사용자는 다시 잠그지 않는다(2026-11-10 사용자 결정). 저장된 기록의 조건 버전(state.conditions)이 since보다 낮으면
// 그때 이미 열려 있던 학년의 새 조건 과목을 예외(state.exempt)로 남긴다(model.js의 normalize).
import recordConditions from '../../../backend/data/record_conditions.json' with { type: 'json' };

// 체험 문구(과목 모듈의 데이터). 키는 등록부의 체험 id다. 새 체험은 import <이름> from "./<id>/data.js";로 불러와
// "<id>": <이름> 꼴로 넣는다. 등록부에 있는데 여기에 없으면 형식이 틀린 것으로 보아 공개하지 않고, 테스트가 실패한다.
export const LAB_DATA = {};

/** 등록부(record_conditions.json의 labs)에 문구를 붙인 체험. { 학과: { 과목: 체험 } }. registry·data는 테스트에서만 준다. */
export function labsFrom(registry = recordConditions.labs, data = LAB_DATA) {
  return Object.fromEntries(
    Object.entries(registry).map(([department, subjects]) => [
      department,
      Object.fromEntries(
        Object.entries(subjects).map(([subject, entry]) => [
          subject,
          // 공개 여부·since는 등록부의 값이 이긴다(문구 모듈에 같은 이름이 있어도 덮는다).
          { ...(Object.hasOwn(data, entry.id) ? data[entry.id] : {}), id: entry.id, status: entry.status, since: entry.since },
        ]),
      ),
    ]),
  );
}

export const LABS = labsFrom();

// 진짜 수업 체험이 아닌 체험이 다시 생긴 과목과 그 이수 조건 버전. 2026-11-10에 내렸던 이론 퀴즈 15과목을 2026-11-12 사용자 결정으로
// 다시 공개했다(backend/data/theory_banks.jsonl). 그사이 다음 학년이 열린 사용자를 다시 잠그지 않도록 since를 둔다.
export const RESTORED = recordConditions.restored;

// 지금 이수 조건 버전. 필수과목에 체험을 새로 공개할 때마다 등록부(record_conditions.json)의 version을 1씩 올리고,
// 그 체험의 since(또는 RESTORED의 값)를 이 값으로 둔다.
// 1: 웹/파이선 체험, 2: 자료구조 체험(둘 다 2026-11-12에 뺐다), 3: 이론 퀴즈 15과목 다시 공개.
export const CONDITIONS = recordConditions.version;

// 검증 기록(checks.js)이 있는 체험 id. 체험을 공개할 때 checks.js에 기록을 넣고 그 id를 여기에도 적는다.
export const CHECKED = [];

const filled = (value) => typeof value === "string" && value.trim() !== "";
const DATE = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;
// 달력에 있는 날짜인지(2026-02-30 같은 값은 거른다).
function realDate(value) {
  const m = typeof value === "string" ? DATE.exec(value) : null;
  if (!m || Number.isNaN(Date.parse(value))) return false;
  const day = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return day.getUTCFullYear() === +m[1] && day.getUTCMonth() === +m[2] - 1 && day.getUTCDate() === +m[3];
}

/** 끝 요약(takeaway)의 형식 문제. 맞으면 빈 배열. */
export function takeawayProblems(takeaway) {
  if (!takeaway || typeof takeaway !== "object" || Array.isArray(takeaway)) return ["takeaway는 { summary, highSchool, terms } 객체여야 해요"];
  const problems = [];
  if (!filled(takeaway.summary)) problems.push("takeaway.summary(한 문장)가 비었어요");
  if (!filled(takeaway.highSchool)) problems.push("takeaway.highSchool(고교 연결)이 비었어요");
  if (!Array.isArray(takeaway.terms) || takeaway.terms.length === 0) problems.push("takeaway.terms(용어 이름표)가 하나 이상 있어야 해요");
  else {
    takeaway.terms.forEach((term, i) => {
      if (!term || !filled(term.name) || !filled(term.meaning)) problems.push(`takeaway.terms[${i}]에 name과 meaning이 있어야 해요`);
    });
    const names = takeaway.terms.map((term) => term?.name?.trim());
    if (new Set(names).size !== names.length) problems.push("takeaway.terms에 같은 이름이 두 번 있어요");
  }
  return problems;
}

/** 검증 기록(check)의 형식 문제. 맞으면 빈 배열. removed는 검토에서 뺀 항목과 이유이고, 뺀 것이 없으면 빈 배열이다. */
export function checkProblems(check) {
  if (!check || typeof check !== "object" || Array.isArray(check)) return ["check는 { reviewer, reviewedAt, removed } 객체여야 해요"];
  const problems = [];
  if (!filled(check.reviewer)) problems.push("check.reviewer(검토자)가 비었어요");
  if (!realDate(check.reviewedAt)) problems.push("check.reviewedAt(검토 시각)은 2026-11-17 또는 2026-11-17T15:00:00+09:00 꼴이어야 해요");
  if (!Array.isArray(check.removed)) problems.push("check.removed(뺀 항목과 이유)는 배열이어야 해요");
  else
    check.removed.forEach((entry, i) => {
      if (!entry || !filled(entry.item) || !filled(entry.reason)) problems.push(`check.removed[${i}]에 item과 reason이 있어야 해요`);
    });
  return problems;
}

/** 체험 데이터의 형식 문제(화면이 쓰는 칸과 끝 요약). 맞으면 빈 배열. */
export function labProblems(lab) {
  if (!lab || typeof lab !== "object") return ["체험 데이터가 객체가 아니에요"];
  const problems = [];
  if (typeof lab.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(lab.id)) problems.push("id는 소문자·숫자·하이픈(kebab-case)이어야 해요");
  if (!Number.isInteger(lab.since) || lab.since < 1) problems.push("since(이수 조건 버전)는 1 이상의 정수여야 해요");
  for (const field of ["title", "task", "source"]) if (!filled(lab[field])) problems.push(`${field}가 비었어요`);
  if (lab.learn !== undefined && !filled(lab.learn)) problems.push("learn은 쓰려면 비우지 않아요");
  return [...problems, ...takeawayProblems(lab.takeaway)];
}

// 공개하는 체험: 별도 에이전트 검토를 통과했고(verified), 검증 기록이 있고(CHECKED), 형식이 맞는 것.
const published = (lab, checked) => (lab?.status === "verified" && checked.includes(lab.id) && labProblems(lab).length === 0 ? lab : null);

/** 그 학과 과목의 체험 데이터(공개하는 것만). 없으면 null. labs·checked는 테스트에서 다른 등록부를 넣어 볼 때만 준다. */
export function labOf(departmentId, subject, labs = LABS, checked = CHECKED) {
  const byDepartment = Object.hasOwn(labs, departmentId) ? labs[departmentId] : null;
  return byDepartment && Object.hasOwn(byDepartment, subject) ? published(byDepartment[subject], checked) : null;
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
  typeof id === "string" &&
  Object.values(LABS).some((subjects) => Object.values(subjects).some((lab) => published(lab, CHECKED) && id === `lab:${lab.id}`));
