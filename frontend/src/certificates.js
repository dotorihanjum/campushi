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
