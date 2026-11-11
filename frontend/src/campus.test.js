import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAMPUS, PLACES, densestSpot, departmentsIn, placeOf } from "./campus.js";
import { BUILDINGS, MAP_H, MAP_W, ROADS, TREES } from "./campusMapData.js";
import { createDepartment } from "./model.js";

test("캠퍼스 지도의 건물은 공식 캠퍼스맵의 번호와 오픈스트리트맵의 실제 위치(0~1)를 가진다", () => {
  assert.ok(CAMPUS.source.startsWith("https://www.khu.ac.kr/"));
  assert.equal(new Set(PLACES.map((p) => p.no)).size, PLACES.length);
  assert.equal(new Set(PLACES.map((p) => p.name)).size, PLACES.length);
  assert.equal(new Set(PLACES.map((p) => p.osm)).size, PLACES.length);
  for (const place of PLACES) {
    assert.ok(["college", "landmark"].includes(place.kind), place.name);
    assert.ok(place.x > 0 && place.x < 1 && place.y > 0 && place.y < 1, place.name);
  }
  // 단과대 건물의 이름표(CampusMap.jsx: 건물 아래 끝에 달고, 글자 10px, 높이 15px)는 서로 겹치지 않는다.
  const box = (p) => ({ x: p.x * MAP_W, y: p.bottom * MAP_H + (p.labelDy || 0), w: p.name.length * 10 + 28 });
  const colleges = PLACES.filter((p) => p.kind === "college").map((p) => ({ p, ...box(p) }));
  for (const a of colleges)
    for (const b of colleges)
      if (a !== b) assert.ok(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= 15, `${a.p.name} · ${b.p.name}`);
});

test("지도 데이터: 공식 캠퍼스맵처럼 가로로 긴 그림이고, 건물·길·나무가 그림 안에 있다", () => {
  assert.ok(MAP_W > MAP_H);
  for (const b of BUILDINGS) {
    assert.ok(b.cx > 0 && b.cx < MAP_W && b.cy > 0 && b.cy < MAP_H && b.w > 0 && b.h > 0 && b.bottom >= b.cy && b.height > 0, String(b.id));
    assert.ok(b.floor.startsWith("M") && b.roof.startsWith("M") && b.walls.length > 0, String(b.id));
  }
  for (const d of ROADS) assert.match(d, /^M[\d.]+ [\d.]+(L-?[\d.]+ -?[\d.]+)+$/);
  for (const [x, y, r] of TREES) assert.ok(x >= 0 && x <= MAP_W && y >= 0 && y <= MAP_H && r > 0);
});

test("서비스의 학과는 모두 지도의 단과대 건물에 있고, 그 건물만 열린다", () => {
  const { departments } = JSON.parse(readFileSync(new URL("../../backend/data/departments.json", import.meta.url), "utf8"));
  const list = departments.map(createDepartment);
  for (const d of list) assert.ok(placeOf(d.building), `${d.name}: ${d.building}`);
  const open = PLACES.filter((p) => departmentsIn(list, p.name).length).map((p) => p.name);
  assert.deepEqual(open.sort(), ["예술·디자인대학관", "전자정보/응용과학대학관"]);
  assert.equal(placeOf("정문"), null);
});

test("시작할 때 고르는 캠퍼스는 경희대 국제캠퍼스(열림)와 서울캠퍼스(준비 중)이고, 열린 캠퍼스만 저장된다", async () => {
  const { CAMPUSES, isOpenCampus } = await import("./campus.js");
  const { normalize } = await import("./model.js");
  assert.deepEqual(CAMPUSES.map((c) => [c.name, c.open]), [["국제캠퍼스", true], ["서울캠퍼스", false]]);
  assert.equal(CAMPUS.id, "khu-global");
  assert.ok(isOpenCampus("khu-global") && !isOpenCampus("khu-seoul") && !isOpenCampus("없음"));
  assert.equal(normalize({ campus: "khu-global" }).campus, "khu-global");
  assert.equal(normalize({ campus: "khu-seoul" }).campus, null);
  assert.equal(normalize({}).campus, null);
});

test("학교 검색: 학교 이름(띄어쓰기 무시, '○○대' 줄임말 포함)으로만 찾고, 없으면 빈 목록", async () => {
  const { findCampuses } = await import("./campus.js");
  const ids = (q) => findCampuses(q).map((c) => c.id);
  assert.deepEqual(ids(""), ["khu-global", "khu-seoul"]);
  assert.deepEqual(ids("   "), ["khu-global", "khu-seoul"]);
  assert.deepEqual(ids("경희"), ["khu-global", "khu-seoul"]);
  assert.deepEqual(ids("경희대"), ["khu-global", "khu-seoul"]);
  assert.deepEqual(ids("경희 대학교"), ["khu-global", "khu-seoul"]);
  // 지역·캠퍼스 이름으로는 찾지 않는다.
  assert.deepEqual(ids("용인"), []);
  assert.deepEqual(ids("국제캠퍼스"), []);
  assert.deepEqual(ids("경희대 국제"), []);
  assert.deepEqual(ids("연세대"), []);
  assert.deepEqual(ids("x".repeat(500)), []);
});

test("홈 지도는 처음에 건물이 가장 많이 모인 곳의 가운데를 보여 준다", () => {
  const box = (cx, cy) => ({ cx, cy, w: 10, h: 10 });
  // 왼쪽에 셋이 모이고 오른쪽에 하나 떨어져 있으면, 왼쪽 셋을 감싸는 상자의 가운데.
  assert.deepEqual(densestSpot(100, 100, [box(10, 10), box(50, 30), box(30, 70), box(400, 300)]), [30, 40]);
  // 창이 모두를 담을 만큼 크면 전체의 가운데.
  assert.deepEqual(densestSpot(1000, 1000, [box(10, 10), box(400, 300)]), [205, 155]);
  // 건물이 없거나 창 크기를 모르면 그림 한가운데.
  assert.deepEqual(densestSpot(100, 100, []), [MAP_W / 2, MAP_H / 2]);
  assert.deepEqual(densestSpot(0, 0), [MAP_W / 2, MAP_H / 2]);
  // 실제 지도: 틀(폭 368)에 보이는 곳은 건물이 몰린 중앙도서관~예술디자인대학 쪽이라, 그림 한가운데보다 왼쪽이다.
  const [x] = densestSpot(368, 400);
  assert.ok(x < MAP_W / 2 - 60, `x=${x}`);
  const inside = BUILDINGS.filter((b) => Math.abs(b.cx - x) <= 184);
  assert.ok(["중앙도서관", "학생회관", "전자정보대학", "예술디자인대학"].every((n) => inside.some((b) => b.name === n)));
});
