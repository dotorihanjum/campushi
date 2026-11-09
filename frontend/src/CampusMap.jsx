import React, { useMemo } from "react";
import { CAMPUS, PLACES, departmentsIn } from "./campus.js";

// 국제캠퍼스 지도 그림. 건물·랜드마크 자리는 공식 캠퍼스맵(campus.js)을 따르고, 길·나무·잔디·연못은 그 지도를 보고 대략 옮긴 꾸밈이다.
// 디자인 시안이 나오면 이 파일의 그림만 바꾼다.

export const MAP_H = 560;
export const MAP_W = Math.round(MAP_H * CAMPUS.ratio);
// 건물이 공식 지도의 위쪽 3/4에 모여 있어 아래쪽(운동장·숲)은 잘라서 보여준다.
export const MAP_SHOWN = Math.round(MAP_H * 0.76);
const PAD = 20;
const px = (x) => PAD + x * MAP_W;
const py = (y) => y * MAP_H;

// 길(꾸밈): 공식 지도의 큰 길을 대략 따른다.
const ROADS = [
  [[0.77, 0.1], [0.7, 0.17], [0.6, 0.21], [0.5, 0.25], [0.44, 0.27], [0.36, 0.27], [0.27, 0.24], [0.2, 0.21]],
  [[0.36, 0.27], [0.33, 0.36], [0.31, 0.46], [0.31, 0.56], [0.29, 0.66]],
  [[0.31, 0.5], [0.4, 0.52], [0.47, 0.52]],
  [[0.2, 0.21], [0.14, 0.3], [0.12, 0.4], [0.15, 0.5], [0.2, 0.58], [0.26, 0.63]],
  [[0.6, 0.21], [0.66, 0.27], [0.73, 0.3]],
  [[0.44, 0.27], [0.45, 0.33]],
];
const path = (points) => points.map(([x, y], i) => `${i ? "L" : "M"}${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join(" ");

// 나무(꾸밈): 숲과 가장자리에 고정된 난수로 흩어 놓고, 건물·길 표시와 겹치는 것은 뺀다.
const FORESTS = [
  { x: [0.8, 1.0], y: [0.36, 0.72], n: 46 },
  { x: [0.0, 0.1], y: [0.0, 0.2], n: 14 },
  { x: [0.1, 0.3], y: [0.0, 0.1], n: 10 },
  { x: [0.52, 0.72], y: [0.4, 0.5], n: 8 },
  { x: [0.36, 0.44], y: [0.6, 0.72], n: 6 },
  { x: [0.62, 0.8], y: [0.5, 0.72], n: 12 },
];
function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), value | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeTrees() {
  const random = seeded(2026);
  const trees = [];
  for (const area of FORESTS)
    for (let i = 0; i < area.n; i++) {
      const x = area.x[0] + random() * (area.x[1] - area.x[0]);
      const y = area.y[0] + random() * (area.y[1] - area.y[0]);
      const near = PLACES.some((p) => Math.abs(px(p.x) - px(x)) < 52 && Math.abs(py(p.y) - py(y)) < 46);
      if (!near && py(y) < MAP_SHOWN - 6) trees.push({ x: px(x), y: py(y), r: 6 + random() * 4 });
    }
  return trees.sort((a, b) => a.y - b.y);
}

/** 단과대 건물 블록(입체). open이면 민트, 아니면 회색. */
function Block({ open }) {
  const c = open
    ? { wall: "#5fd6cd", side: "#26b0a7", roof: "#c9f5f1", window: "#f2fffd" }
    : { wall: "#d3d9e0", side: "#b6c0ca", roof: "#eef1f4", window: "#f8fafb" };
  return (
    <svg width="56" height="44" viewBox="0 0 56 44" aria-hidden>
      <ellipse cx="27" cy="40" rx="25" ry="3.6" fill="rgba(20,60,40,0.16)" />
      <polygon points="4,12 34,12 49,5 19,5" fill={c.roof} />
      <rect x="4" y="12" width="30" height="27" fill={c.wall} />
      <polygon points="34,12 49,5 49,32 34,39" fill={c.side} />
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((k) => <rect key={`${r}-${k}`} x={7.2 + k * 6.4} y={15 + r * 6.6} width="3.6" height="4" rx="0.6" fill={c.window} />))}
      {[0, 1].map((k) => [0, 1, 2].map((r) => (
        <polygon key={`s${k}-${r}`} points={`${37.5 + k * 5.5},${16.5 + r * 6.6 - k * 2.5} ${40.5 + k * 5.5},${15 + r * 6.6 - k * 2.5} ${40.5 + k * 5.5},${19 + r * 6.6 - k * 2.5} ${37.5 + k * 5.5},${20.5 + r * 6.6 - k * 2.5}`} fill={c.window} opacity="0.75" />
      )))}
      <rect x="16" y="32" width="6" height="7" fill={c.side} />
    </svg>
  );
}

/** 랜드마크 그림: 정문(아치), 도서관(기둥), 학생회관(작은 건물). 대운동장은 바탕 그림에 그린다. */
function LandmarkIcon({ name }) {
  if (name === "정문")
    return (
      <svg width="40" height="30" viewBox="0 0 40 30" aria-hidden>
        <rect x="4" y="8" width="6" height="20" fill="#f4f1ea" stroke="#cfc6b4" />
        <rect x="30" y="8" width="6" height="20" fill="#f4f1ea" stroke="#cfc6b4" />
        <path d="M4 9 Q20 -4 36 9" fill="none" stroke="#cfc6b4" strokeWidth="4" />
        <path d="M4 9 Q20 -4 36 9" fill="none" stroke="#f4f1ea" strokeWidth="2" />
      </svg>
    );
  const library = name === "중앙도서관";
  return (
    <svg width={library ? 50 : 38} height="30" viewBox={library ? "0 0 50 30" : "0 0 38 30"} aria-hidden>
      <ellipse cx={library ? 25 : 19} cy="27" rx={library ? 23 : 17} ry="2.6" fill="rgba(20,60,40,0.14)" />
      {library ? (
        <>
          <polygon points="3,9 25,2 47,9" fill="#e9e3d6" />
          <rect x="4" y="9" width="42" height="17" fill="#fbf8f1" stroke="#d9d1bf" />
          {[0, 1, 2, 3, 4, 5].map((k) => <rect key={k} x={8 + k * 6.6} y="11" width="2.6" height="13" fill="#e2dac8" />)}
        </>
      ) : (
        <>
          <rect x="4" y="7" width="30" height="19" fill="#fbe9c9" stroke="#e7cf9f" />
          {[0, 1, 2].map((k) => <rect key={k} x={8 + k * 9} y="11" width="5" height="5" fill="#fffaf0" />)}
          <rect x="16" y="19" width="6" height="7" fill="#e7cf9f" />
        </>
      )}
    </svg>
  );
}

/**
 * 지도. departments: 학과 목록(학과가 있는 건물만 열림), onOpen(건물 이름): 열린 건물을 눌렀을 때, onLocked(건물 이름): 잠긴 건물을 눌렀을 때.
 */
export default function CampusMap({ departments, onOpen, onLocked }) {
  const trees = useMemo(makeTrees, []);
  const track = PLACES.find((p) => p.name === "대운동장");
  return (
    <div className="relative overflow-hidden rounded-[24px]" style={{ width: MAP_W + PAD * 2, height: MAP_SHOWN }}>
      {/* 바탕: 잔디, 길, 대운동장, 광장, 연못, 나무 */}
      <svg className="absolute inset-0" width={MAP_W + PAD * 2} height={MAP_SHOWN} aria-hidden>
        <defs>
          <radialGradient id="grass" cx="40%" cy="40%" r="80%">
            <stop offset="0%" stopColor="#e4f6dc" />
            <stop offset="65%" stopColor="#cdeac2" />
            <stop offset="100%" stopColor="#bfe2b3" />
          </radialGradient>
          <pattern id="grain" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="4" r="0.9" fill="#b5d9a8" opacity="0.6" />
            <circle cx="10" cy="11" r="0.8" fill="#b5d9a8" opacity="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grass)" />
        <rect width="100%" height="100%" fill="url(#grain)" />
        {/* 사색의 광장 */}
        <rect x={px(0.215)} y={py(0.395)} width={58} height={44} rx="6" fill="#f3efe4" stroke="#e0d8c4" />
        <rect x={px(0.232)} y={py(0.41)} width={30} height={14} rx="3" fill="#a9dcf0" />
        {/* 연못 */}
        <ellipse cx={px(0.14)} cy={py(0.69)} rx="34" ry="16" fill="#a9dcf0" stroke="#8ccbe3" strokeWidth="2" />
        {ROADS.map((points, i) => (
          <path key={`b${i}`} d={path(points)} fill="none" stroke="#e2dac6" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {ROADS.map((points, i) => (
          <path key={`r${i}`} d={path(points)} fill="none" stroke="#f7f3e8" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {/* 대운동장 트랙 */}
        <g transform={`translate(${px(track.x)} ${py(track.y)})`}>
          <ellipse rx="72" ry="34" fill="#e5a877" stroke="#d48f5c" strokeWidth="2" />
          <ellipse rx="56" ry="22" fill="#8fd27f" stroke="#ffffff" strokeWidth="1.5" />
          <line x1="0" y1="-22" x2="0" y2="22" stroke="#ffffff" strokeWidth="1.2" />
          <circle r="6" fill="none" stroke="#ffffff" strokeWidth="1.2" />
        </g>
        {trees.map((tree, i) => (
          <g key={i} transform={`translate(${tree.x.toFixed(1)} ${tree.y.toFixed(1)})`}>
            <ellipse cy={tree.r * 0.95} rx={tree.r * 0.9} ry={tree.r * 0.32} fill="rgba(20,60,40,0.14)" />
            <rect x="-1.2" y={tree.r * 0.3} width="2.4" height={tree.r * 0.6} fill="#9b7653" />
            <circle r={tree.r} fill="#58b265" />
            <circle cx={-tree.r * 0.3} cy={-tree.r * 0.3} r={tree.r * 0.55} fill="#78c983" />
          </g>
        ))}
      </svg>

      {/* 랜드마크(누를 수 없음) */}
      {PLACES.filter((p) => p.kind === "landmark").map((p) => (
        <div
          key={p.no}
          className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center"
          style={{ left: px(p.x), top: py(p.y) - (p.name === "대운동장" ? 46 : 16) }}
        >
          {p.name !== "대운동장" && <LandmarkIcon name={p.name} />}
          <span className="mt-[1px] whitespace-nowrap rounded-full bg-white/80 px-[7px] py-[1px] text-[10px] font-medium text-ink-3">{p.name}</span>
        </div>
      ))}

      {/* 단과대 건물 */}
      {PLACES.filter((p) => p.kind === "college").map((p) => {
        const here = departmentsIn(departments, p.name);
        const open = here.length > 0;
        return (
          <button
            key={p.no}
            onClick={() => (open ? onOpen(p.name) : onLocked(p.name))}
            aria-label={open ? `${p.name}, ${here.map((d) => d.name).join(", ")}` : `${p.name}, 준비 중`}
            className="pressable absolute flex w-[84px] -translate-x-1/2 flex-col items-center"
            style={{ left: px(p.x), top: py(p.y) - 26, zIndex: open ? 3 : 2 }}
          >
            {open && (
              <svg className="loop absolute -top-[22px]" style={{ animation: "float 1.8s ease-in-out infinite" }} width="20" height="26" viewBox="0 0 20 26" aria-hidden>
                <path d="M10 25S1.5 15.4 1.5 9.6a8.5 8.5 0 0 1 17 0C18.5 15.4 10 25 10 25Z" fill="#27d8cd" stroke="#087f77" strokeWidth="1.5" />
                <circle cx="10" cy="9.5" r="3.3" fill="#fff" />
              </svg>
            )}
            <Block open={open} />
            <span
              className={`-mt-[1px] max-w-[84px] rounded-full px-[7px] py-[1.5px] text-center text-[10px] font-semibold leading-[13px] ${
                open ? "bg-white text-ink-2 shadow-[0_2px_6px_rgba(8,127,119,0.25)]" : "bg-white/75 text-gray"
              }`}
              style={{ wordBreak: "keep-all" }}
            >
              {open ? p.name.replace("/", "/​") : `🔒 ${p.name}`}
            </span>
            {open && (
              <span className="mt-[2px] rounded-full bg-mint px-[7px] py-[1.5px] text-[9.5px] font-bold leading-[12px] text-white">
                {here.map((d) => d.name).join(" · ")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
