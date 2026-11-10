// 과목 성적. 2026-11-10부터 새로 받는 성적은 모두 P(끝까지 해보고 기록을 남기면 이수)이고, 아래 등급표는 그 전에 정답률로 받은 기록을 보여 줄 때만 쓴다.
// 기준선은 2026-11-09 사용자 결정(추천안, 추후 조정 예정)이다. 바꿀 때는 이 표만 고친다.
// 점수를 매길 수 없는 체험(도색 같은 작품)은 끝까지 하면 P(통과)다.

// [등급, 이 정답률(%) 이상, 평점(4.5 만점)]
export const GRADES = [
  ["A+", 95, 4.5],
  ["A0", 90, 4.3],
  ["A-", 85, 4.0],
  ["B+", 80, 3.5],
  ["B0", 75, 3.3],
  ["B-", 70, 3.0],
  ["C+", 65, 2.5],
  ["C0", 60, 2.3],
  ["C-", 55, 2.0],
  ["D+", 50, 1.5],
  ["D0", 45, 1.3],
  ["D-", 40, 1.0],
  ["F", 0, 0],
];
export const PASS_GRADE = "B-";
export const PASS = "P";

const rank = (grade) => (grade === PASS ? -1 : GRADES.findIndex(([name]) => name === grade));
export const isGrade = (grade) => grade === PASS || GRADES.some(([name]) => name === grade);

// 체험 결과: { correct, total } 또는 "P". 형식이 맞지 않으면 null.
export function cleanScore(score) {
  if (score === PASS) return PASS;
  if (!score || typeof score !== "object") return null;
  const { correct, total } = score;
  return Number.isInteger(total) && total > 0 && Number.isInteger(correct) && correct >= 0 && correct <= total ? { correct, total } : null;
}

// 정답률(0~100, 정수). P는 null.
export const percentOf = (score) => (score === PASS ? null : Math.round((score.correct / score.total) * 100));

// 체험 결과로 등급을 매긴다: { grade, percent }.
export function gradeOf(score) {
  const clean = cleanScore(score);
  if (!clean) return null;
  if (clean === PASS) return { grade: PASS, percent: null };
  const percent = percentOf(clean);
  return { grade: GRADES.find(([, min]) => percent >= min)[0], percent };
}

// B- 이상이거나 P면 이수(다음 학년 해금에 인정)다. C+ 이하는 재수강해야 한다.
export const passes = (grade) => isGrade(grade) && rank(grade) <= rank(PASS_GRADE);

// 두 성적 중 더 좋은 것(재수강하면 가장 좋은 성적을 남긴다). P는 이수 성적 중 가장 낮게 친다.
export function better(a, b) {
  if (!isGrade(a)) return b;
  if (!isGrade(b)) return a;
  if (a === PASS || b === PASS) {
    const other = a === PASS ? b : a;
    return passes(other) ? other : PASS;
  }
  return rank(a) <= rank(b) ? a : b;
}

// 평균 평점(4.5 만점, 소수 둘째 자리). P와 성적이 없는 과목은 빼고, 하나도 없으면 null.
export function averagePoint(grades) {
  const points = grades.filter((grade) => isGrade(grade) && grade !== PASS).map((grade) => GRADES[rank(grade)][2]);
  return points.length ? Math.round((points.reduce((a, b) => a + b, 0) / points.length) * 100) / 100 : null;
}
