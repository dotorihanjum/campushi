// 시작 화면(시작하기)과 학교·캠퍼스 고르기.
import { useEffect, useRef, useState } from "react";
import { img } from "../assets.js";
import { BackButton, Center, delay, OutlineButton, Screen, T, SchoolLogo } from "../ui.jsx";
import { CAMPUSES, findCampuses } from "../campus.js";
import { josa } from "./shared.jsx";

export function Splash({ nav, state, setState }) {
  // 시작하기 → 학교(캠퍼스) 고르기 → 지도. 이미 캠퍼스를 골랐으면 바로 지도로 간다.
  const start = () => {
    setState((s) => ({ ...s, onboarded: true }));
    nav.reset([state.campus ? "home" : "school"]);
  };
  return (
    <Screen
      foot={724}
      footer={
        <OutlineButton top={740} onClick={start} className="a-up" style={delay(0.8)}>
          시작하기
        </OutlineButton>
      }
    >
      <Center>
        <div className="a-drop absolute left-[110px] top-[281px] h-[170px] w-[162px]" style={delay(0.1)}>
          <img
            src={img.mascotSplash}
            alt="캠퍼스하이 마스코트"
            className="loop h-full w-full"
            style={{ animation: "float 3.2s ease-in-out 1.1s infinite" }}
          />
        </div>
        <img
          src={img.wordmark}
          alt="캠퍼스하이"
          className="a-up absolute left-[127px] top-[474px] h-[33px] w-[148px]"
          style={delay(0.55)}
        />
      </Center>
    </Screen>
  );
}

// 처음(시작하기 다음)에는 뒤로 갈 곳이 없고, 지도·마이페이지에서 "학교 바꾸기"로 들어오면 뒤로 갈 수 있다.
export function School({ nav, state, setState, route }) {
  const changing = !!route?.params?.change;
  // 준비 중인 캠퍼스를 눌렀을 때의 안내.
  const [hint, setHint] = useState("");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // 학교 검색: 학교 이름으로 찾는다(campus.js의 findCampuses).
  const [query, setQuery] = useState("");
  const found = findCampuses(query);
  const pick = (campus) => {
    if (!campus.open) {
      setHint(`${campus.school} ${josa(campus.name, "은", "는")} 아직 준비 중이에요.`);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setHint(""), 2600);
      return;
    }
    setState((s) => ({ ...s, onboarded: true, campus: campus.id }));
    nav.reset(["home"], "fade");
  };
  return (
    <Screen>
      {changing && <BackButton onClick={nav.back} />}
      <T y={104} size={28} lh={38} left={20} className="a-up font-bold text-navy">
        {changing ? "다른 학교로\n가볼까요?" : "어느 학교로\n가볼까요?"}
      </T>
      <T y={194} size={14.5} left={20.5} clip={360} className="a-up text-gray" style={delay(0.06)}>
        {changing ? "학교를 바꿔도 체험 기록과 크레딧은 그대로 남아요." : "캠퍼스를 고르면 그 캠퍼스 지도로 이동해요."}
      </T>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          e.currentTarget.querySelector("input").blur();
        }}
        className="a-up absolute left-[20px] top-[232px] w-[362px]"
        style={delay(0.09)}
      >
        <label htmlFor="school-search" className="sr-only">
          학교 검색
        </label>
        <svg className="pointer-events-none absolute left-[15px] top-[15px] text-gray" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <circle cx="7.8" cy="7.8" r="5.8" stroke="currentColor" strokeWidth="2" />
          <path d="m12.2 12.2 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id="school-search"
          type="search"
          value={query}
          maxLength={40}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="학교 이름으로 찾기 (예: 경희대)"
          autoComplete="off"
          enterKeyHint="search"
          className="h-[48px] w-full rounded-[14px] border border-line bg-chalk pl-[42px] pr-[44px] text-[16px] text-ink-2 outline-none placeholder:text-mute focus:border-mint focus:bg-white [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={(e) => {
              setQuery("");
              e.currentTarget.previousElementSibling.focus();
            }}
            className="pressable absolute right-[6px] top-[6px] flex h-[36px] w-[36px] items-center justify-center rounded-full text-gray"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <circle cx="8" cy="8" r="8" fill="#d1d5da" />
              <path d="m5.2 5.2 5.6 5.6M10.8 5.2l-5.6 5.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </form>
      {found.length === 0 && (
        <div className="absolute left-[20px] right-[20px] top-[304px] rounded-[18px] border border-line bg-chalk px-[18px] py-[20px] text-center" role="status">
          <p className="truncate text-[15px] font-semibold leading-[22px] text-ink-2">{`'${query.trim()}'에 맞는 학교가 아직 없어요`}</p>
          <p className="mt-[4px] text-[13px] leading-[20px] text-gray" style={{ wordBreak: "keep-all" }}>
            {`지금은 ${[...new Set(CAMPUSES.map((c) => c.school))].join(", ")} 캠퍼스만 있어요.`}
          </p>
          <button className="text-button mt-[8px]" onClick={() => setQuery("")}>
            전체 보기
          </button>
        </div>
      )}
      {found.map((campus, i) => (
        <button
          key={campus.id}
          onClick={() => pick(campus)}
          aria-label={`${campus.school} ${campus.name}${campus.open ? "" : ", 준비 중"}`}
          className={`pressable a-up absolute left-[20px] flex h-[96px] w-[362px] items-center gap-[14px] rounded-[18px] border-2 px-[16px] text-left ${
            campus.open ? "border-mint bg-white shadow-[0_8px_20px_rgba(39,216,205,0.18)]" : "border-line bg-chalk"
          }`}
          style={{ top: 304 + i * 112, ...delay(0.12 + i * 0.06) }}
        >
          {/* 로고 원본은 가로가 긴 3:2라서 칸도 3:2로 둔다(찌그러지지 않게). */}
          <span className={`h-[48px] w-[72px] shrink-0 ${campus.open ? "" : "opacity-40 grayscale"}`}>
            <SchoolLogo school={campus.school} size={46} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[12.5px] font-semibold leading-[18px] text-gray">{campus.school}</span>
            <span className={`truncate text-[18px] font-bold leading-[25px] ${campus.open ? "text-ink-2" : "text-gray"}`}>{campus.name}</span>
            <span className="truncate text-[12px] leading-[18px] text-gray">{campus.region}</span>
          </span>
          {campus.open ? (
            <span className="flex h-[28px] shrink-0 items-center rounded-full bg-mint px-[12px] text-[13px] font-bold text-white">
              {state.campus === campus.id ? "지금 캠퍼스" : "입장 →"}
            </span>
          ) : (
            <span className="flex h-[28px] shrink-0 items-center rounded-full border border-line bg-white px-[10px] text-[12px] font-semibold text-gray">🔒 준비 중</span>
          )}
        </button>
      ))}
      <p
        key={hint || "none"}
        role="status"
        className={`absolute left-[20px] right-[20px] text-center text-[13px] leading-[20px] text-mint-deep ${hint ? "a-shake" : ""}`}
        style={{ top: 304 + Math.max(found.length, 1) * 112 + 6 }}
      >
        {hint}
      </p>
    </Screen>
  );
}
