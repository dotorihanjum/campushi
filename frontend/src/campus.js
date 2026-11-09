// 경희대학교 국제캠퍼스 지도(홈). 건물 이름과 위치는 학교 공식 캠퍼스맵을 따른다.
// 출처: https://www.khu.ac.kr/kor/user/contents/view.do?menuNo=200086 (2026-11-09 확인). x, y는 공식 지도 그림에서
// 그 건물 번호 표시가 있는 자리(왼쪽 위 0, 오른쪽 아래 1)다. 지도 그림 자체는 쓰지 않고 위치만 옮겨 단순한 도형으로 그린다.
// 디자인 시안이 나오면 그림만 바꾼다.

// 시작하기 다음에 고르는 학교·캠퍼스. 지금은 경희대 국제캠퍼스만 열려 있고 서울캠퍼스는 준비 중(2026-11-09 사용자 결정).
// 주소(지역)는 경희대 공식 사이트 표기를 따른다.
export const CAMPUSES = [
  { id: "khu-global", school: "경희대학교", name: "국제캠퍼스", region: "경기도 용인시 기흥구", open: true },
  { id: "khu-seoul", school: "경희대학교", name: "서울캠퍼스", region: "서울특별시 동대문구", open: false },
];
export const isOpenCampus = (id) => CAMPUSES.some((campus) => campus.id === id && campus.open);

export const CAMPUS = {
  id: "khu-global",
  school: "경희대학교",
  name: "국제캠퍼스",
  source: "https://www.khu.ac.kr/kor/user/contents/view.do?menuNo=200086",
  // 공식 지도 그림의 가로:세로(1933 × 1344).
  ratio: 1933 / 1344,
};

// kind: college(단과대학 건물, 학과가 들어갈 수 있음) | landmark(길을 찾는 데 쓰는 곳, 누를 수 없음).
// no는 공식 캠퍼스맵의 번호다.
export const PLACES = [
  { no: 1, name: "정문", kind: "landmark", x: 0.77, y: 0.074 },
  { no: 6, name: "공학관", kind: "college", x: 0.751, y: 0.276 },
  { no: 9, name: "체육대학관", kind: "college", x: 0.588, y: 0.267 },
  { no: 10, name: "외국어대학관", kind: "college", x: 0.566, y: 0.143 },
  { no: 14, name: "대운동장", kind: "landmark", x: 0.372, y: 0.16 },
  { no: 18, name: "생명과학대학관", kind: "college", x: 0.464, y: 0.371 },
  { no: 21, name: "예술·디자인대학관", kind: "college", x: 0.489, y: 0.557 },
  { no: 22, name: "국제·경영대학관", kind: "college", x: 0.359, y: 0.389 },
  { no: 23, name: "학생회관", kind: "landmark", x: 0.291, y: 0.267 },
  { no: 24, name: "중앙도서관", kind: "landmark", x: 0.16, y: 0.264 },
  { no: 31, name: "전자정보/응용과학대학관", kind: "college", x: 0.238, y: 0.618 },
  { no: 32, name: "국제학관", kind: "college", x: 0.154, y: 0.437 },
];

export const placeOf = (name) => PLACES.find((place) => place.kind === "college" && place.name === name) || null;

// 건물마다 그 건물에 있는 (서비스의) 학과. 학과가 하나도 없는 단과대 건물은 잠긴 건물로 보인다.
export const departmentsIn = (departments, name) => departments.filter((d) => d.building === name);
