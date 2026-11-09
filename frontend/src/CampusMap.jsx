import React from "react";
import { PLACES, departmentsIn } from "./campus.js";
import { BUILDINGS, CAMPUS_AREA, MAP_H, MAP_W, ROADS, SHAPES } from "./campusMapData.js";

// 국제캠퍼스 지도 그림. 건물 윤곽·길·숲·연못·운동장은 오픈스트리트맵의 실제 데이터(campusMapData.js)를 그대로 그리고,
// 건물 이름·번호는 공식 캠퍼스맵(campus.js)을 따른다. 공식 캠퍼스맵처럼 북쪽이 오른쪽이다.
// 디자인 시안이 나오면 이 파일의 그림(색·모양)만 바꾼다.

export { MAP_H, MAP_W };
// 지도 그림 전체를 보여준다(화면이 낮으면 Home에서 위아래로 밀어 본다).
export const MAP_SHOWN = MAP_H;

const px = (x) => x * MAP_W;
const py = (y) => y * MAP_H;
// 지도에 이름표를 다는 건물(번호 → 장소). 그 밖의 건물은 윤곽만 그린다.
const LABELED = new Map(PLACES.map((p) => [p.osm, p]));

/** 건물 윤곽. 아래쪽에 짙은 색을 한 번 더 깔아 살짝 입체로 보이게 한다. */
function Footprint({ d, open, named }) {
  const c = open
    ? { side: "#1fa69d", roof: "#5fd6cd", line: "#178f87" }
    : named
      ? { side: "#b9c2cc", roof: "#e3e8ed", line: "#aab4bf" }
      : { side: "#c9d0d7", roof: "#edf0f3", line: "#c3cad2" };
  return (
    <>
      <path d={d} transform="translate(0 3)" fill={c.side} fillRule="evenodd" />
      <path d={d} fill={c.roof} stroke={c.line} strokeWidth="0.8" fillRule="evenodd" />
    </>
  );
}

/**
 * 지도. departments: 학과 목록(학과가 있는 건물만 열림), onOpen(건물 이름): 열린 건물을 눌렀을 때, onLocked(건물 이름): 잠긴 건물을 눌렀을 때.
 */
export default function CampusMap({ departments, onOpen, onLocked }) {
  const openIds = new Set(PLACES.filter((p) => p.kind === "college" && departmentsIn(departments, p.name).length).map((p) => p.osm));
  return (
    <div className="relative overflow-hidden rounded-[24px]" style={{ width: MAP_W, height: MAP_H }}>
      {/* 바탕: 캠퍼스 밖 산, 캠퍼스 안 잔디, 숲, 연못, 운동장, 주차장, 길, 건물 윤곽 */}
      <svg className="absolute inset-0" width={MAP_W} height={MAP_H} aria-hidden>
        <defs>
          <radialGradient id="grass" cx="50%" cy="45%" r="75%">
            <stop offset="0%" stopColor="#e6f6de" />
            <stop offset="100%" stopColor="#cfe9c4" />
          </radialGradient>
          <pattern id="grain" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="4" r="0.9" fill="#b5d9a8" opacity="0.6" />
            <circle cx="10" cy="11" r="0.8" fill="#b5d9a8" opacity="0.5" />
          </pattern>
          <pattern id="trees" width="18" height="16" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="4.6" fill="#6cbf72" />
            <circle cx="3.8" cy="3.8" r="2" fill="#8fd393" />
            <circle cx="14" cy="12" r="4.2" fill="#62b769" />
            <circle cx="12.8" cy="10.8" r="1.8" fill="#86cd8b" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="#cfe7c3" />
        <rect width="100%" height="100%" fill="url(#trees)" opacity="0.3" />
        <path d={CAMPUS_AREA} fill="url(#grass)" stroke="#b3d6a5" strokeWidth="2" fillRule="evenodd" />
        <path d={CAMPUS_AREA} fill="url(#grain)" fillRule="evenodd" />
        {SHAPES.grass.map((d, i) => <path key={`g${i}`} d={d} fill="#d3edc6" />)}
        {SHAPES.wood.map((d, i) => <path key={`w${i}`} d={d} fill="#c3e2b6" />)}
        {SHAPES.wood.map((d, i) => <path key={`wt${i}`} d={d} fill="url(#trees)" opacity="0.55" />)}
        {SHAPES.water.map((d, i) => <path key={`o${i}`} d={d} fill="#a9dcf0" stroke="#8ccbe3" strokeWidth="1.5" />)}
        {SHAPES.parking.map((d, i) => <path key={`p${i}`} d={d} fill="#eceae4" stroke="#dcd8cd" strokeWidth="0.8" />)}
        {SHAPES.stadium.map((d, i) => <path key={`s${i}`} d={d} fill="#e5a877" stroke="#d48f5c" strokeWidth="1.5" />)}
        {SHAPES.pitch.map((d, i) => <path key={`f${i}`} d={d} fill="#8fd27f" stroke="#ffffff" strokeWidth="1.2" />)}
        {ROADS.major.map((d, i) => <path key={`rb${i}`} d={d} fill="none" stroke="#e2dac6" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />)}
        {ROADS.major.map((d, i) => <path key={`r${i}`} d={d} fill="none" stroke="#f7f3e8" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />)}
        {ROADS.minor.map((d, i) => <path key={`m${i}`} d={d} fill="none" stroke="#f4efe2" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />)}
        {BUILDINGS.map((b) => <Footprint key={b.id} d={b.d} open={openIds.has(b.id)} named={LABELED.has(b.id) || !!b.name} />)}
      </svg>

      {/* 랜드마크 이름(누를 수 없음) */}
      {PLACES.filter((p) => p.kind === "landmark").map((p) => (
        <span
          key={p.no}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white/85 px-[7px] py-[1px] text-[10px] font-medium text-ink-3"
          style={{ left: px(p.x), top: py(p.y) }}
        >
          {p.name}
        </span>
      ))}

      {/* 단과대 건물: 열린 건물은 핀과 학과 이름, 잠긴 건물은 자물쇠 */}
      {PLACES.filter((p) => p.kind === "college").map((p) => {
        const here = departmentsIn(departments, p.name);
        const open = here.length > 0;
        return (
          <button
            key={p.no}
            onClick={() => (open ? onOpen(p.name) : onLocked(p.name))}
            aria-label={open ? `${p.name}, ${here.map((d) => d.name).join(", ")}` : `${p.name}, 준비 중`}
            className="pressable absolute flex w-[96px] -translate-x-1/2 flex-col items-center"
            style={{ left: px(p.x), top: py(p.y) + (p.labelDy || 0) - (open ? 30 : 9), zIndex: open ? 3 : 2 }}
          >
            {open && (
              <svg className="loop mb-[2px]" style={{ animation: "float 1.8s ease-in-out infinite" }} width="20" height="26" viewBox="0 0 20 26" aria-hidden>
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
