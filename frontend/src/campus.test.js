import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAMPUS, PLACES, departmentsIn, placeOf } from "./campus.js";
import { createDepartment } from "./model.js";

test("캠퍼스 지도의 건물은 공식 캠퍼스맵의 번호와 위치(0~1)를 가진다", () => {
  assert.ok(CAMPUS.source.startsWith("https://www.khu.ac.kr/"));
  assert.equal(new Set(PLACES.map((p) => p.no)).size, PLACES.length);
  assert.equal(new Set(PLACES.map((p) => p.name)).size, PLACES.length);
  for (const place of PLACES) {
    assert.ok(["college", "landmark"].includes(place.kind), place.name);
    assert.ok(place.x > 0 && place.x < 1 && place.y > 0 && place.y < 1, place.name);
  }
  // 단과대 건물은 지도에서 서로 겹치지 않게 떨어져 있다(CampusMap.jsx: 지도 폭 MAP_W, 건물 표시 폭 84px·높이 약 60px).
  const colleges = PLACES.filter((p) => p.kind === "college");
  for (const a of colleges)
    for (const b of colleges)
      if (a !== b) assert.ok(Math.abs(a.x - b.x) * 805 >= 84 || Math.abs(a.y - b.y) * 560 >= 60, `${a.name} · ${b.name}`);
});

test("서비스의 학과는 모두 지도의 단과대 건물에 있고, 그 건물만 열린다", () => {
  const { departments } = JSON.parse(readFileSync(new URL("../../backend/data/departments.json", import.meta.url), "utf8"));
  const list = departments.map(createDepartment);
  for (const d of list) assert.ok(placeOf(d.building), `${d.name}: ${d.building}`);
  const open = PLACES.filter((p) => departmentsIn(list, p.name).length).map((p) => p.name);
  assert.deepEqual(open.sort(), ["예술·디자인대학관", "전자정보/응용과학대학관"]);
  assert.equal(placeOf("정문"), null);
});
