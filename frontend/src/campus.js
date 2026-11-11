// 경희대학교 국제캠퍼스 지도(홈). 건물 이름과 번호는 학교 공식 캠퍼스맵을 따르고
// (https://www.khu.ac.kr/kor/user/contents/view.do?menuNo=200086, 2026-11-09 확인), 위치·윤곽은 오픈스트리트맵의
// 실제 데이터(campusMapData.js, scripts/campus-map.mjs)에서 가져온다. osm은 그 건물의 오픈스트리트맵 번호다.
import { BUILDINGS, MAP_H, MAP_W, STADIUMS } from "./campusMapData.js";

// 시작하기 다음에 고르는 학교·캠퍼스. 지금은 경희대 국제캠퍼스만 열려 있고 서울캠퍼스는 준비 중(2026-11-09 사용자 결정).
// 주소(지역)는 경희대 공식 사이트 표기를 따른다.
export const CAMPUSES = [
  { id: "khu-global", school: "경희대학교", name: "국제캠퍼스", region: "경기도 용인시 기흥구", open: true },
  { id: "khu-seoul", school: "경희대학교", name: "서울캠퍼스", region: "서울특별시 동대문구", open: false },
];
export const isOpenCampus = (id) => CAMPUSES.some((campus) => campus.id === id && campus.open);

// 학교 검색: 띄어쓰기와 대소문자를 무시하고 학교 이름에 검색어가 들어 있는 캠퍼스(그 학교의 캠퍼스 모두). 빈 검색어면 전부.
// "대학교"를 "대"로 줄여 써도 찾는다(예: 경희대). 지역·캠퍼스 이름으로는 찾지 않는다(사용자 결정).
const squash = (text) => text.replace(/\s+/g, "").toLowerCase();
export function findCampuses(query, campuses = CAMPUSES) {
  const q = squash(query || "");
  if (!q) return campuses;
  return campuses.filter((c) => {
    const name = squash(c.school);
    return name.includes(q) || name.replace(/대학교$/, "대").includes(q);
  });
}

export const CAMPUS = {
  id: "khu-global",
  school: "경희대학교",
  name: "국제캠퍼스",
  source: "https://www.khu.ac.kr/kor/user/contents/view.do?menuNo=200086",
};

// kind: college(단과대학 건물, 학과가 들어갈 수 있음) | landmark(길을 찾는 데 쓰는 곳, 누를 수 없음).
// no는 공식 캠퍼스맵의 번호, osm은 오픈스트리트맵의 건물(대운동장은 경기장) 번호다.
// x, y는 지도 그림에서 그 건물 윤곽의 중심, bottom은 윤곽의 아래 끝(왼쪽 위 0, 오른쪽 아래 1)이다. 이름표는 건물 아래 끝에
// 단다. labelDy는 이웃 건물과 이름표가 겹치지 않게 이름표를 위(-)·아래(+)로 옮기는 px다.
const SPOTS = [
  { no: 1, name: "정문", kind: "landmark", osm: 473963422 },
  { no: 6, name: "공학관", kind: "college", osm: 455725718 },
  { no: 9, name: "체육대학관", kind: "college", osm: 455726113 },
  { no: 10, name: "외국어대학관", kind: "college", osm: 585696507 },
  { no: 14, name: "대운동장", kind: "landmark", osm: 455725379 },
  { no: 18, name: "생명과학대학관", kind: "college", osm: 474521121, labelDy: 14 },
  { no: 21, name: "예술·디자인대학관", kind: "college", osm: 474085536 },
  { no: 22, name: "국제·경영대학관", kind: "college", osm: 474085539 },
  { no: 23, name: "학생회관", kind: "landmark", osm: 474085535 },
  { no: 24, name: "중앙도서관", kind: "landmark", osm: 474085534 },
  { no: 31, name: "전자정보/응용과학대학관", kind: "college", osm: 474085540 },
  { no: 32, name: "국제학관", kind: "college", osm: 474085542 },
];
const centerOf = (osm) => BUILDINGS.find((b) => b.id === osm) || STADIUMS.find((s) => s.id === osm);
export const PLACES = SPOTS.map((spot) => {
  const at = centerOf(spot.osm);
  if (!at) throw new Error(`지도 데이터에 ${spot.name}(${spot.osm})이 없습니다.`);
  return { ...spot, x: at.cx / MAP_W, y: at.cy / MAP_H, bottom: (at.bottom ?? at.cy + at.h / 2) / MAP_H };
});

export const placeOf = (name) => PLACES.find((place) => place.kind === "college" && place.name === name) || null;

// 건물마다 그 건물에 있는 (서비스의) 학과. 학과가 하나도 없는 단과대 건물은 잠긴 건물로 보인다.
export const departmentsIn = (departments, name) => departments.filter((d) => d.building === name);

/**
 * 폭 w·높이 h(지도 px)의 창을 지도 위에 놓았을 때 바닥 중심이 가장 많이 들어오는 건물 무리를 찾아, 그 무리를 감싸는 상자의
 * 가운데 [x, y]를 돌려준다. 홈 지도가 처음 보여 줄 곳이다. 가장 많이 담는 창은 늘 왼쪽·위쪽 끝이 어떤 건물 중심에 닿게 옮길
 * 수 있으므로 그 자리들만 본다. 같은 수의 창이 여럿이면 왼쪽 위의 것을 고른다(매번 같은 곳을 보여 주도록).
 */
export function densestSpot(w, h, buildings = BUILDINGS) {
  if (!buildings.length || !(w > 0) || !(h > 0)) return [MAP_W / 2, MAP_H / 2];
  const xs = [...new Set(buildings.map((b) => b.cx))].sort((a, b) => a - b);
  const ys = [...new Set(buildings.map((b) => b.cy))].sort((a, b) => a - b);
  let best = [];
  for (const x of xs) {
    for (const y of ys) {
      const inside = buildings.filter((b) => b.cx >= x && b.cx <= x + w && b.cy >= y && b.cy <= y + h);
      if (inside.length > best.length) best = inside;
    }
  }
  const left = Math.min(...best.map((b) => b.cx - b.w / 2));
  const right = Math.max(...best.map((b) => b.cx + b.w / 2));
  const top = Math.min(...best.map((b) => b.cy - b.h / 2));
  const bottom = Math.max(...best.map((b) => b.cy + b.h / 2));
  return [(left + right) / 2, (top + bottom) / 2];
}
