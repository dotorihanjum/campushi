// 과목의 체험 종류와 저장된 체험 결과 확인.
import { isLessonType } from "./lessonGames.js";
import { GROUPS } from "./groups.js";

// 그 과목의 연습 문제 유형(lessonGames: 과목 → 유형). 없으면 null.
export function gameFor(subject, lessonGames = {}) {
  const type = Object.hasOwn(lessonGames, subject) ? lessonGames[subject] : null;
  return isLessonType(type) ? type : null;
}
// 저장된 체험 결과가 지금도 있는 체험의 것인지: 연습 문제 유형이거나 학과군 실습(group:학과군).
export const isGame = (id) =>
  isLessonType(id) || (typeof id === "string" && GROUPS.some((group) => id === `group:${group.id}`));
