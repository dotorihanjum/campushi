// 경희대 국제캠퍼스 지도 데이터 만들기: 오픈스트리트맵(OSM)의 실제 건물 윤곽·길·숲·운동장을 받아
// 홈 지도(CampusMap.jsx)가 그리는 좌표로 바꿔 frontend/src/campusMapData.js에 쓴다.
//
//   node scripts/campus-map.mjs            # Overpass API에서 새로 받는다
//   node scripts/campus-map.mjs <폴더>      # 전에 받아 둔 campus.json·rels.json으로 만든다
//
// 데이터 © OpenStreetMap contributors, ODbL 1.0(https://www.openstreetmap.org/copyright). 지도에 출처 표기가 있어야 한다.
// 방향: 학교 공식 캠퍼스맵과 같게 실제 지도를 시계 방향으로 90도 돌려 그린다(북쪽이 오른쪽, 동쪽이 아래).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CAMPUS_RELATION = 11246784; // 경희대학교 국제캠퍼스
const MAP_H = 560; // 지도 그림의 높이(px). 폭은 실제 비율대로 정해진다.
const MARGIN_M = 45; // 건물·운동장 바깥으로 더 보여줄 여백(m)
// 건물 벽 높이(px). 오픈스트리트맵에 층수가 있으면 한 층에 4px(최소 12, 최대 24), 없으면 16.
const WALL = (tags) => (tags["building:levels"] ? Math.min(24, Math.max(12, Number(tags["building:levels"]) * 4)) : 16);
const OUT = new URL("../frontend/src/campusMapData.js", import.meta.url);

const QUERY_FEATURES = `[out:json][timeout:90];rel(${CAMPUS_RELATION});map_to_area->.c;(way["building"](area.c);way["highway"](area.c);way["natural"](area.c);way["leisure"](area.c);way["landuse"](area.c);way["amenity"="parking"](area.c););out geom tags;`;
const QUERY_RELATIONS = `[out:json][timeout:90];rel(${CAMPUS_RELATION});map_to_area->.c;(rel(${CAMPUS_RELATION});rel["building"](area.c););out geom;`;

async function overpass(query) {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "campushi-map-builder" },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass 요청 실패: ${res.status}`);
  return res.json();
}

const dir = process.argv[2];
const features = dir ? JSON.parse(readFileSync(join(dir, "campus.json"), "utf8")) : await overpass(QUERY_FEATURES);
const relations = dir ? JSON.parse(readFileSync(join(dir, "rels.json"), "utf8")) : await overpass(QUERY_RELATIONS);

// 위경도 → 미터(동쪽 e, 남쪽 s) → 90도 돌린 지도 좌표(u: 북쪽으로, v: 동쪽으로).
const LAT0 = 37.243;
const K = Math.cos((LAT0 * Math.PI) / 180);
const turn = (p) => [p.lat * 110574, p.lon * K * 111320];

const ways = features.elements.filter((e) => e.type === "way" && e.geometry && e.tags);
const buildingRelations = relations.elements.filter((e) => e.id !== CAMPUS_RELATION && e.tags?.building);

// 보여줄 범위: 건물·운동장·주차장을 모두 담는 상자 + 여백.
const focus = ways.filter((w) => w.tags.building || w.tags.leisure === "pitch" || w.tags.leisure === "stadium" || w.tags.amenity === "parking");
const focusPoints = [...focus.flatMap((w) => w.geometry), ...buildingRelations.flatMap((r) => r.members.flatMap((m) => m.geometry || []))].map(turn);
const umin = Math.min(...focusPoints.map((p) => p[0])) - MARGIN_M;
const umax = Math.max(...focusPoints.map((p) => p[0])) + MARGIN_M;
const vmin = Math.min(...focusPoints.map((p) => p[1])) - MARGIN_M;
const vmax = Math.max(...focusPoints.map((p) => p[1])) + MARGIN_M;
const scale = MAP_H / (vmax - vmin);
const MAP_W = Math.round((umax - umin) * scale);
const toMap = (p) => {
  const [u, v] = turn(p);
  return [(u - umin) * scale, (v - vmin) * scale];
};

// 점이 너무 많은 선은 줄인다(더글라스-포이커, 0.6px 안의 굴곡은 버린다).
function simplify(points, tolerance = 0.6) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points.at(-1)];
  let far = 0;
  let at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // 닫힌 고리(처음과 끝이 같은 점)는 그 점까지의 거리로 잰다.
    const d = len ? Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len : Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (d > far) [far, at] = [d, i];
  }
  if (far <= tolerance) return [a, b];
  return [...simplify(points.slice(0, at + 1), tolerance).slice(0, -1), ...simplify(points.slice(at), tolerance)];
}
const r1 = (n) => Math.round(n * 10) / 10;
const line = (geometry, closed, tolerance) => {
  const pts = simplify(geometry.map(toMap), tolerance);
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join("") + (closed ? "Z" : "");
};
const centroid = (geometry) => {
  // 닫힌 다각형의 넓이 중심.
  const pts = geometry.map(toMap);
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const c = x0 * y1 - x1 * y0;
    area += c;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
  }
  if (!area) return [pts[0][0], pts[0][1]];
  return [r1(cx / (3 * area)), r1(cy / (3 * area))];
};
const closed = (w) => w.geometry.length > 3 && w.geometry[0].lat === w.geometry.at(-1).lat && w.geometry[0].lon === w.geometry.at(-1).lon;

// 캠퍼스 경계: 바깥 테두리 길들을 이어 한 다각형으로 만든다.
function joinRings(members) {
  const segments = members.map((m) => m.geometry.map((p) => [p.lat, p.lon]));
  const rings = [];
  while (segments.length) {
    let ring = segments.shift();
    let grew = true;
    while (grew && (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1])) {
      grew = false;
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        const end = ring.at(-1);
        const same = (a, b) => a[0] === b[0] && a[1] === b[1];
        if (same(s[0], end)) ring = [...ring, ...s.slice(1)];
        else if (same(s.at(-1), end)) ring = [...ring, ...[...s].reverse().slice(1)];
        else continue;
        segments.splice(i, 1);
        grew = true;
        break;
      }
    }
    rings.push(ring.map(([lat, lon]) => ({ lat, lon })));
  }
  return rings;
}

// 그림 스타일(일러스트)에 맞게 고른다: 차가 다니는 길·보행로만 굵게 그리고(주차장 칸·오솔길·계단은 뺀다),
// 숲은 그 안에 동그란 나무를 심어 그린다. 건물은 실제 윤곽을 바닥으로 벽을 세워 입체(2.5D)로 그린다.

// 입체 건물: 바닥 윤곽(rings)에서 보는 쪽(아래)을 향한 벽과, 벽 높이만큼 올린 지붕을 만든다.
function extrude(rings, tags) {
  const height = WALL(tags);
  const pts = rings.map((g) => simplify(g.map(toMap)));
  const walls = [];
  for (const ring of pts) {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    const sign = area > 0 ? 1 : -1;
    for (let i = 0; i < ring.length - 1; i++) {
      const [a, z] = [ring[i], ring[i + 1]];
      const nx = (z[1] - a[1]) * sign;
      const ny = -(z[0] - a[0]) * sign;
      if (ny <= 0) continue;
      // [x1, y1, x2, y2, 옆면(1)·앞면(0), 창문 줄을 그릴 만큼 긴가(1·0)]
      walls.push([r1(a[0]), r1(a[1]), r1(z[0]), r1(z[1]), Math.abs(nx) / Math.hypot(nx, ny) > 0.6 ? 1 : 0, Math.hypot(z[0] - a[0], z[1] - a[1]) > 8 ? 1 : 0]);
    }
  }
  walls.sort((p, q) => p[1] + p[3] - (q[1] + q[3]));
  const d = (dy) => pts.map((ring) => ring.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y - dy)}`).join("") + "Z").join("");
  const bottom = r1(Math.max(...pts.flat().map((q) => q[1])));
  return { height, floor: d(0), roof: d(height), walls, bottom };
}
const shapes = { wood: [], water: [], pitch: [] };
const roads = [];
const stadiums = [];
const buildings = [];
const bbox = (geometry) => {
  const pts = geometry.map(toMap);
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  return { w: r1(Math.max(...xs) - Math.min(...xs)), h: r1(Math.max(...ys) - Math.min(...ys)) };
};
const woodRings = [];
const roadPoints = [];
const avoid = [];
for (const w of ways) {
  const t = w.tags;
  if (t.building) {
    const [cx, cy] = centroid(w.geometry);
    buildings.push({ id: w.id, name: t.name || "", cx, cy, ...bbox(w.geometry), ...extrude([w.geometry], t) });
  } else if (t.highway) {
    if ((t.highway === "service" && !t.service) || t.highway === "pedestrian") {
      roads.push(line(w.geometry, false, 2));
      roadPoints.push(...w.geometry.map(toMap));
    }
  } else if (!closed(w)) continue;
  else if (t.natural === "wood" || t.landuse === "forest") {
    shapes.wood.push(line(w.geometry, true, 2));
    woodRings.push(w.geometry.map(toMap));
  } else if (t.natural === "water" || t.water) shapes.water.push(line(w.geometry, true, 1));
  else if (t.leisure === "stadium") {
    const [cx, cy] = centroid(w.geometry);
    stadiums.push({ id: w.id, cx, cy, ...bbox(w.geometry) });
    avoid.push(w.geometry.map(toMap));
  } else if (t.leisure === "pitch") {
    shapes.pitch.push(line(w.geometry, true, 1));
    avoid.push(w.geometry.map(toMap));
  }
}
for (const r of buildingRelations) {
  const outer = joinRings(r.members.filter((m) => m.role === "outer"));
  const [cx, cy] = centroid(outer[0]);
  buildings.push({ id: r.id, name: r.tags.name || "", cx, cy, ...bbox(outer[0]), ...extrude(outer, r.tags) });
}
buildings.sort((a, b) => a.bottom - b.bottom || a.id - b.id);

// 나무: 고른 간격(+고정 난수로 조금 흔듦)의 자리 중 숲 안은 절반쯤, 숲 밖 잔디는 드문드문 심는다.
// 길·건물·운동장 위에는 심지 않는다.
const inside = (pt, ring) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
let seed = 2026;
const random = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const STEP = 22;
const trees = [];
for (let gy = STEP / 2; gy < MAP_H; gy += STEP)
  for (let gx = STEP / 2; gx < MAP_W; gx += STEP) {
    const pt = [gx + (random() - 0.5) * STEP * 0.8, gy + (random() - 0.5) * STEP * 0.8];
    const r = 6 + random() * 3.5;
    const chance = random();
    if (chance > (woodRings.some((ring) => inside(pt, ring)) ? 0.55 : 0.07)) continue;
    if (roadPoints.some((q) => Math.hypot(q[0] - pt[0], q[1] - pt[1]) < 12)) continue;
    if (buildings.some((b) => Math.abs(b.cx - pt[0]) < b.w / 2 + 12 && Math.abs(b.cy - pt[1]) < b.h / 2 + 12)) continue;
    if (avoid.some((ring) => inside(pt, ring))) continue;
    trees.push([r1(pt[0]), r1(pt[1]), r1(r)]);
  }
trees.sort((a, b) => a[1] - b[1]);

const header = `// 자동 생성 파일: node scripts/campus-map.mjs 로 다시 만든다. 손으로 고치지 않는다.
// 경희대 국제캠퍼스의 실제 건물 위치·길·숲·운동장. 데이터 © OpenStreetMap contributors, ODbL 1.0
// (https://www.openstreetmap.org/copyright), ${new Date().toISOString().slice(0, 10)} 받음.
// 좌표는 지도 그림의 px(폭 MAP_W, 높이 MAP_H)이고, 공식 캠퍼스맵처럼 실제 지도를 시계 방향으로 90도 돌렸다(북쪽이 오른쪽).
// BUILDINGS(아래쪽 끝 순서): cx·cy는 바닥 윤곽의 중심, w·h는 윤곽을 담는 상자, bottom은 윤곽의 아래 끝, height는 벽 높이,
// floor·roof는 바닥·지붕 윤곽, walls는 보이는 벽 [x1, y1, x2, y2, 옆면, 창문]이다. TREES는 [x, y, 반지름]이다.
`;
const body = [
  `export const MAP_W = ${MAP_W};`,
  `export const MAP_H = ${MAP_H};`,
  `export const SHAPES = ${JSON.stringify(shapes)};`,
  `export const STADIUMS = ${JSON.stringify(stadiums)};`,
  `export const ROADS = ${JSON.stringify(roads)};`,
  `export const TREES = ${JSON.stringify(trees)};`,
  `export const BUILDINGS = [\n${buildings.map((b) => "  " + JSON.stringify(b)).join(",\n")},\n];`,
].join("\n");
writeFileSync(OUT, header + body + "\n");
console.log(`지도 ${MAP_W}×${MAP_H}px, 건물 ${buildings.length}, 길 ${roads.length}, 나무 ${trees.length}, 물 ${shapes.water.length}, 경기장 ${shapes.pitch.length}`);
