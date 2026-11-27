// 증명서 다시 보기(#23): 학과마다 다시 볼 수 있는 증명서와, 다시 보기로 연 화면인지.

/** 증명서 화면(screens/index.js의 SCREENS 이름)과 화면에 보이는 이름. 이 순서로 보여 준다. */
export const CERTIFICATES = [
  { screen: "enrolled", name: "입학증" },
  { screen: "grades", name: "성적표" },
  { screen: "diploma", name: "졸업증명서" },
];

/**
 * 다시 볼 수 있는 증명서. 입학하지 않았으면 없고, 입학만 했으면 입학증, 졸업했으면 입학증·성적표·졸업증명서.
 * journey는 state.journeys[학과id], progress는 model.js의 progressOf 결과.
 */
export function reviewableCertificates(journey, progress) {
  if (!journey || typeof journey !== "object") return [];
  const graduated = progress?.graduated === true;
  return CERTIFICATES.filter((c) => c.screen === "enrolled" || graduated);
}

/** 체험 탭에서 다시 보기로 연 증명서 화면인지(화면 기록의 params). 이때는 다음 화면으로 넘어가지 않는다. */
export const isReview = (params) => params?.review === true;

/** 다시 보기로 증명서를 열 때 넘기는 params. */
export const REVIEW = Object.freeze({ review: true });

/** 성적표 종이에 적는 과목 목록의 최대 줄 수("외 N과목" 줄 포함). 서명 줄("체험생", y 288.5)과 붙지 않는 높이다(164 + 7×16 = 276). */
export const TRANSCRIPT_ROWS = 7;

/**
 * 성적표에 적을 과목과 "외 N과목"의 N. 다 들어가면 모두 적고(more 0),
 * 넘치면 "외 N과목" 줄까지 합쳐 rows줄이 되게 앞의 rows-1과목만 적는다.
 */
export function transcriptRows(courses, rows = TRANSCRIPT_ROWS) {
  const list = Array.isArray(courses) ? courses : [];
  const shown = list.length <= rows ? list : list.slice(0, Math.max(0, rows - 1));
  return { shown, more: list.length - shown.length };
}
