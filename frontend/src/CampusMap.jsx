import React from "react";
import { PLACES, departmentsIn } from "./campus.js";
import { BUILDINGS, MAP_H, MAP_W, ROADS, SHAPES, STADIUMS, TREES } from "./campusMapData.js";

// 국제캠퍼스 지도 그림. 건물·길·숲·연못·운동장의 자리는 오픈스트리트맵의 실제 데이터(campusMapData.js)를 따르고,
// 그림은 일러스트로 그린다(건물은 실제 윤곽을 세운 입체, 숲은 동그란 나무). 건물 이름·번호는 공식 캠퍼스맵(campus.js)을 따르며,
// 공식 캠퍼스맵처럼 북쪽이 오른쪽이다. 디자인 시안이 나오면 이 파일의 그림(색·모양)만 바꾼다.

export { MAP_H, MAP_W };
// 지도 그림 전체를 보여준다(화면이 낮으면 Home에서 위아래로 밀어 본다).
export const MAP_SHOWN = MAP_H;

const px = (x) => x * MAP_W;
const py = (y) => y * MAP_H;

const COLORS = {
  open: { roof: "#a8efe9", front: "#4fcfc5", side: "#22a49b", window: "#effffd", line: "#1f9e95" },
  locked: { roof: "#e8ecf0", front: "#c9d1da", side: "#a9b4c0", window: "#f8fafb", line: "#a9b3be" },
  other: { roof: "#eef1f4", front: "#d6dce2", side: "#bcc5ce", window: "#fbfcfd", line: "#bcc4cc" },
};
const f1 = (n) => Math.round(n * 10) / 10;

/** 입체 건물: 그림자, 보이는 벽(창문 줄), 지붕. */
function Building({ b, c }) {
  const h = b.height;
  return (
    <g>
      <path d={b.floor} transform="translate(3 2)" fill="rgba(20,60,40,0.16)" />
      {b.walls.map(([x1, y1, x2, y2, side, windows], i) => (
        <g key={i}>
          <path d={`M${x1} ${y1}L${x2} ${y2}L${x2} ${f1(y2 - h)}L${x1} ${f1(y1 - h)}Z`} fill={side ? c.side : c.front} />
          {windows === 1 &&
            [0.35, 0.68].map((t) => (
              <path key={t} d={`M${x1} ${f1(y1 - h * t)}L${x2} ${f1(y2 - h * t)}`} stroke={c.window} strokeWidth="1.6" strokeDasharray="2.4 2" opacity="0.9" />
            ))}
        </g>
      ))}
      <path d={b.roof} fill={c.roof} stroke={c.line} strokeWidth="0.8" strokeLinejoin="round" fillRule="evenodd" />
    </g>
  );
}

/** 정문 그림(아치). 실제 정문은 가는 구조물이라 윤곽 대신 이 그림을 쓴다. */
function Gate() {
  return (
    <svg width="40" height="30" viewBox="0 0 40 30" aria-hidden>
      <rect x="4" y="8" width="6" height="20" fill="#f4f1ea" stroke="#cfc6b4" />
      <rect x="30" y="8" width="6" height="20" fill="#f4f1ea" stroke="#cfc6b4" />
      <path d="M4 9 Q20 -4 36 9" fill="none" stroke="#cfc6b4" strokeWidth="4" />
      <path d="M4 9 Q20 -4 36 9" fill="none" stroke="#f4f1ea" strokeWidth="2" />
    </svg>
  );
}

const GATE = PLACES.find((p) => p.name === "정문");
const byId = new Map(BUILDINGS.map((b) => [b.id, b]));
const placeOfId = new Map(PLACES.map((p) => [p.osm, p]));

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
        {BUILDINGS.filter((b) => b.id !== GATE.osm).map((b) => {
          const place = placeOfId.get(b.id);
          const open = place?.kind === "college" && departmentsIn(departments, place.name).length > 0;
          const c = open ? COLORS.open : place?.kind === "college" ? COLORS.locked : COLORS.other;
          if (place?.kind !== "college") return <Building key={b.id} b={b} c={c} />;
          // 단과대 건물 그림도 누를 수 있다(키보드·화면 낭독기는 아래 이름표 버튼으로 누른다).
          return (
            <g key={b.id} className="cursor-pointer" style={{ pointerEvents: "auto" }} onClick={() => (open ? onOpen(place.name) : onLocked(place.name))}>
              <Building b={b} c={c} />
            </g>
          );
        })}
      </svg>

      {/* 랜드마크 이름(누를 수 없음). 건물은 지붕 가운데, 정문은 아치 그림 아래에 단다. */}
      {PLACES.filter((p) => p.kind === "landmark").map((p) => {
        const top = p === GATE ? py(p.y) - 26 : py(p.y) - (byId.get(p.osm)?.height ?? 0) - 9;
        return (
          <div key={p.no} className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center" style={{ left: px(p.x), top }}>
            {p === GATE && <Gate />}
            <span className="mt-[1px] whitespace-nowrap rounded-full bg-white/85 px-[7px] py-[1px] text-[10px] font-medium text-ink-3">{p.name}</span>
          </div>
        );
      })}

      {/* 단과대 이름표: 열린 건물은 핀과 학과 이름, 잠긴 건물은 자물쇠 */}
      {PLACES.filter((p) => p.kind === "college").map((p) => {
        const here = departmentsIn(departments, p.name);
        const open = here.length > 0;
        // 이름표는 건물 아래 끝에, 핀은 지붕 가운데 위에 둔다.
        const labelTop = py(p.bottom) + 3 + (p.labelDy || 0);
        const pinTop = py(p.y) - (byId.get(p.osm)?.height ?? 0) - 26;
        return (
          <button
            key={p.no}
            onClick={() => (open ? onOpen(p.name) : onLocked(p.name))}
            aria-label={open ? `${p.name}, ${here.map((d) => d.name).join(", ")}` : `${p.name}, 준비 중`}
            className="pressable absolute flex w-[96px] -translate-x-1/2 flex-col items-center"
            style={{ left: px(p.x), top: labelTop, zIndex: open ? 3 : 2 }}
          >
            {open && (
              <svg className="loop absolute" style={{ top: pinTop - labelTop, animation: "float 1.8s ease-in-out infinite" }} width="20" height="26" viewBox="0 0 20 26" aria-hidden>
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
