import React from "react";
import { PLACES, departmentsIn } from "./campus.js";
import { BUILDINGS, MAP_H, MAP_W, ROADS, SHAPES, STADIUMS, TREES } from "./campusMapData.js";

// 국제캠퍼스 지도 그림. 건물·길·숲·연못·운동장의 자리는 오픈스트리트맵의 실제 데이터(campusMapData.js)를 따르고,
// 그림은 일러스트로 그린다(건물은 입체 블록, 숲은 동그란 나무). 건물 이름·번호는 공식 캠퍼스맵(campus.js)을 따르며,
// 공식 캠퍼스맵처럼 북쪽이 오른쪽이다. 디자인 시안이 나오면 이 파일의 그림(색·모양)만 바꾼다.

export { MAP_H, MAP_W };
// 지도 그림 전체를 보여준다(화면이 낮으면 Home에서 위아래로 밀어 본다).
export const MAP_SHOWN = MAP_H;

const px = (x) => x * MAP_W;
const py = (y) => y * MAP_H;
const PLACE_IDS = new Set(PLACES.map((p) => p.osm));

const BLOCK_COLORS = {
  open: { wall: "#5fd6cd", side: "#26b0a7", roof: "#c9f5f1", window: "#f2fffd" },
  locked: { wall: "#d3d9e0", side: "#b6c0ca", roof: "#eef1f4", window: "#f8fafb" },
  other: { wall: "#e3e7eb", side: "#c8cfd6", roof: "#f4f6f8", window: "#fbfcfd" },
};

/** 입체 건물 블록(56×44). 단과대·다른 건물 모두 이 모양을 쓰고 색만 다르다. */
function BlockShape({ c }) {
  return (
    <>
      <ellipse cx="27" cy="40" rx="25" ry="3.6" fill="rgba(20,60,40,0.16)" />
      <polygon points="4,12 34,12 49,5 19,5" fill={c.roof} />
      <rect x="4" y="12" width="30" height="27" fill={c.wall} />
      <polygon points="34,12 49,5 49,32 34,39" fill={c.side} />
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((k) => <rect key={`${r}-${k}`} x={7.2 + k * 6.4} y={15 + r * 6.6} width="3.6" height="4" rx="0.6" fill={c.window} />))}
      {[0, 1].map((k) => [0, 1, 2].map((r) => (
        <polygon key={`s${k}-${r}`} points={`${37.5 + k * 5.5},${16.5 + r * 6.6 - k * 2.5} ${40.5 + k * 5.5},${15 + r * 6.6 - k * 2.5} ${40.5 + k * 5.5},${19 + r * 6.6 - k * 2.5} ${37.5 + k * 5.5},${20.5 + r * 6.6 - k * 2.5}`} fill={c.window} opacity="0.75" />
      )))}
      <rect x="16" y="32" width="6" height="7" fill={c.side} />
    </>
  );
}

function Block({ open }) {
  return (
    <svg width="56" height="44" viewBox="0 0 56 44" aria-hidden>
      <BlockShape c={open ? BLOCK_COLORS.open : BLOCK_COLORS.locked} />
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

// 이름표가 없는 건물(기숙사·실험동 등)은 실제 크기에 맞춰 작은 블록으로 그린다.
const others = BUILDINGS.filter((b) => !PLACE_IDS.has(b.id)).map((b) => ({ ...b, s: Math.min(0.8, Math.max(0.42, Math.max(b.w, b.h) / 60)) }));

/**
 * 지도. departments: 학과 목록(학과가 있는 건물만 열림), onOpen(건물 이름): 열린 건물을 눌렀을 때, onLocked(건물 이름): 잠긴 건물을 눌렀을 때.
 */
export default function CampusMap({ departments, onOpen, onLocked }) {
  return (
    <div className="relative overflow-hidden rounded-[24px]" style={{ width: MAP_W, height: MAP_H }}>
      {/* 바탕: 잔디, 연못, 운동장, 길, 나무, 작은 건물 */}
      <svg className="absolute inset-0" width={MAP_W} height={MAP_H} aria-hidden>
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
        {SHAPES.water.map((d, i) => <path key={`o${i}`} d={d} fill="#a9dcf0" stroke="#8ccbe3" strokeWidth="2" strokeLinejoin="round" />)}
        {SHAPES.pitch.map((d, i) => <path key={`f${i}`} d={d} fill="#9bd68b" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />)}
        {ROADS.map((d, i) => <path key={`b${i}`} d={d} fill="none" stroke="#e2dac6" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />)}
        {ROADS.map((d, i) => <path key={`r${i}`} d={d} fill="none" stroke="#f7f3e8" strokeWidth="10.5" strokeLinecap="round" strokeLinejoin="round" />)}
        {/* 대운동장 트랙 */}
        {STADIUMS.map((s) => (
          <g key={s.id} transform={`translate(${s.cx} ${s.cy})`}>
            <ellipse rx={s.w / 2} ry={s.h / 2} fill="#e5a877" stroke="#d48f5c" strokeWidth="2" />
            <ellipse rx={s.w / 2 - 14} ry={s.h / 2 - 11} fill="#8fd27f" stroke="#ffffff" strokeWidth="1.5" />
            <line x1="0" y1={-(s.h / 2 - 11)} x2="0" y2={s.h / 2 - 11} stroke="#ffffff" strokeWidth="1.2" />
            <circle r="6" fill="none" stroke="#ffffff" strokeWidth="1.2" />
          </g>
        ))}
        {TREES.map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <ellipse cy={r * 0.95} rx={r * 0.9} ry={r * 0.32} fill="rgba(20,60,40,0.14)" />
            <rect x="-1.2" y={r * 0.3} width="2.4" height={r * 0.6} fill="#9b7653" />
            <circle r={r} fill="#58b265" />
            <circle cx={-r * 0.3} cy={-r * 0.3} r={r * 0.55} fill="#78c983" />
          </g>
        ))}
        {others.map((b) => (
          <g key={b.id} transform={`translate(${b.cx - 27 * b.s} ${b.cy - 30 * b.s}) scale(${b.s})`}>
            <BlockShape c={BLOCK_COLORS.other} />
          </g>
        ))}
      </svg>

      {/* 랜드마크(누를 수 없음) */}
      {PLACES.filter((p) => p.kind === "landmark").map((p) => (
        <div
          key={p.no}
          className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center"
          style={{ left: px(p.x), top: py(p.y) - (p.name === "대운동장" ? 9 : 22) }}
        >
          {p.name !== "대운동장" && <LandmarkIcon name={p.name} />}
          <span className="mt-[1px] whitespace-nowrap rounded-full bg-white/80 px-[7px] py-[1px] text-[10px] font-medium text-ink-3">{p.name}</span>
        </div>
      ))}

      {/* 단과대 건물 그림(눌러도 된다). 이름표가 이웃 건물 그림에 가려지지 않게 그림은 아래 층, 이름표는 위 층에 둔다. */}
      {PLACES.filter((p) => p.kind === "college").map((p) => {
        const open = departmentsIn(departments, p.name).length > 0;
        return (
          <div
            key={p.no}
            aria-hidden
            onClick={() => (open ? onOpen(p.name) : onLocked(p.name))}
            className="pressable absolute -translate-x-1/2 cursor-pointer"
            style={{ left: px(p.x), top: py(p.y) + (p.labelDy || 0) - 30 }}
          >
            <Block open={open} />
          </div>
        );
      })}

      {/* 단과대 이름표: 열린 건물은 핀과 학과 이름, 잠긴 건물은 자물쇠 */}
      {PLACES.filter((p) => p.kind === "college").map((p) => {
        const here = departmentsIn(departments, p.name);
        const open = here.length > 0;
        return (
          <button
            key={p.no}
            onClick={() => (open ? onOpen(p.name) : onLocked(p.name))}
            aria-label={open ? `${p.name}, ${here.map((d) => d.name).join(", ")}` : `${p.name}, 준비 중`}
            className="pressable absolute flex w-[96px] -translate-x-1/2 flex-col items-center"
            style={{ left: px(p.x), top: py(p.y) + (p.labelDy || 0) + 13, zIndex: open ? 3 : 2 }}
          >
            {open && (
              <svg className="loop absolute -top-[65px]" style={{ animation: "float 1.8s ease-in-out infinite" }} width="20" height="26" viewBox="0 0 20 26" aria-hidden>
                <path d="M10 25S1.5 15.4 1.5 9.6a8.5 8.5 0 0 1 17 0C18.5 15.4 10 25 10 25Z" fill="#27d8cd" stroke="#087f77" strokeWidth="1.5" />
                <circle cx="10" cy="9.5" r="3.3" fill="#fff" />
              </svg>
            )}
            <span
              className={`max-w-[96px] rounded-full px-[7px] py-[1.5px] text-center text-[10px] font-semibold leading-[13px] ${
                open ? "bg-white text-ink-2 shadow-[0_2px_6px_rgba(8,127,119,0.25)]" : "bg-white/85 text-gray"
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

      {/* 오픈스트리트맵 데이터 출처(ODbL에 따라 표기해야 한다) */}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-[6px] right-[10px] rounded-full bg-white/70 px-[6px] text-[9px] leading-[14px] text-ink-3"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
