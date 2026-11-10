import React, { Component, Suspense, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { icon, img, yearCharacter } from "./assets.js";
import {
  BackButton,
  Center,
  Confetti,
  delay,
  FilledButton,
  Header,
  Mask,
  OutlineButton,
  Paper,
  PaperFold,
  Screen,
  T,
  Dialog,
  PanView,
  SchoolLogo,
  Toast,
} from "./ui.jsx";
import {
  CREDIT_PER_PASS,
  YEARS,
  departmentsOf,
  completeCourse,
  courseKey,
  initialState,
  gameOf,
  isRequired,
  kindOf,
  labFor,
  nextStepOf,
  progressOf,
  recordOf,
  savePlay,
  yearOf,
  yearSubjects,
} from "./model.js";
import { averagePoint, gradeOf, passes, PASS, PASS_GRADE } from "./grades.js";
import { isLessonType, lessonTypes } from "./lessonGames.js";
import LessonGame, { useLessonGame } from "./Games.jsx";
import { Rub } from "./Templates.jsx";
import { templates } from "./experiences.js";
import { GROUPS, groupName } from "./groups.js";
import { gameFor } from "./games.js";
import { LAB_SCREENS } from "./labs/components.js";
import {
  ALL,
  BODY_MAX,
  COMMENT_MAX,
  MINE,
  TITLE_MAX,
  addComment,
  addQuestion,
  checkComment,
  checkPost,
  communityStore,
  filterQuestions,
  timeAgo,
} from "./community.js";
import { MOCK_MENTORS } from "./communityMock.js";
import { CAMPUS, CAMPUSES, PLACES, departmentsIn, findCampuses } from "./campus.js";
import CampusMap, { MAP_H, MAP_W } from "./CampusMap.jsx";

/* ------------------------------------------------------------------ */
/* 공통                                                                */
/* ------------------------------------------------------------------ */

// 학과 목록.
const all = (state) => departmentsOf(state);

/** 지금 보고 있는 학과와 그 진행 상황(progressOf). 학교가 정해진 학과가 없으면 null. */
function view(state) {
  const d = all(state).find((item) => item.id === state.current && item.school);
  if (!d) return null;
  return { d, journey: state.journeys[d.id] || null, progress: progressOf(state, d), final: d.final };
}

// 성적 글자: "B+", 정답률이 있으면 "B+ (82%)".
const gradeText = (record) => (record ? `${record.grade}${Number.isInteger(record.percent) ? ` (${record.percent}%)` : ""}` : "");

// 학년마다 처음에 보여 주는 과목 칩 줄 수.
const SHOWN_ROWS = 2;
const CHIP = "max-w-full rounded-[16px] border px-[12px] py-[6px] text-[13px] leading-[19px]";

/**
 * 한 학년의 과목 칩. 칩은 글자 길이만큼의 폭으로 이어 놓고 줄 끝에서 다음 줄로 넘긴다(아주 긴 이름은 칩 안에서 줄바꿈한다).
 * 실제로 그려진 줄(칩의 offsetTop)을 세어 SHOWN_ROWS줄까지만 보이고, 넘는 칩은 더보기로 펼친다. 폭이 바뀌면 다시 센다.
 */
function YearChips({ year, chips }) {
  const list = useRef(null);
  const listId = useId();
  // 칩 목록이 바뀔 때만 다시 잰다(chips 배열은 그릴 때마다 새로 만들어진다).
  const names = chips.map((c) => `${c.open ? 1 : 0}${c.name}`).join("|");
  const [opened, setOpened] = useState(false);
  // 보이는 줄까지의 높이, 전체 높이, 숨는 칩 수.
  const [fit, setFit] = useState({ shown: 0, full: 0, hidden: 0 });
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const measure = () => {
      const items = [...el.children];
      const tops = [...new Set(items.map((item) => item.offsetTop))].sort((x, y) => x - y);
      const cut = tops[SHOWN_ROWS];
      const kept = cut === undefined ? items : items.filter((item) => item.offsetTop < cut);
      const shown = Math.max(0, ...kept.map((item) => item.offsetTop + item.offsetHeight));
      const full = Math.max(0, ...items.map((item) => item.offsetTop + item.offsetHeight));
      const hidden = items.length - kept.length;
      setFit((f) => (f.shown === shown && f.full === full && f.hidden === hidden ? f : { shown, full, hidden }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [names]);
  const folded = fit.hidden > 0 && !opened;
  return (
    <>
      <ul
        ref={list}
        id={listId}
        className="relative mt-[8px] flex flex-wrap gap-[8px] overflow-hidden transition-[max-height] duration-300 ease-out motion-reduce:transition-none"
        style={fit.hidden > 0 ? { maxHeight: folded ? fit.shown : fit.full } : undefined}
      >
        {chips.map(({ name, open, required }, i) => {
          // 접혀서 잘린 칩은 화면 낭독기에도 읽히지 않게 한다(줄을 세려고 자리는 그대로 둔다).
          const cut = folded && i >= chips.length - fit.hidden;
          return (
            <li
              key={`${open ? "open" : "plan"}-${name}`}
              aria-hidden={cut || undefined}
              className={`${CHIP} ${open ? "border-mint bg-mint-soft font-semibold text-mint-deep" : "border-line bg-white text-ink-2"}`}
              style={{ wordBreak: "keep-all", overflowWrap: "anywhere" }}
            >
              <span className="sr-only">{open ? "체험 과목 " : "구현 예정 "}</span>
              {name}
              {required && <span className={`ml-[4px] text-[10.5px] font-bold ${open ? "text-mint" : "text-gray"}`}>필수</span>}
            </li>
          );
        })}
      </ul>
      {fit.hidden > 0 && (
        <button
          className="pressable mt-[6px] flex h-[28px] items-center gap-[4px] rounded-[8px] pr-[4px] text-[12.5px] text-gray"
          aria-expanded={opened}
          aria-controls={listId}
          aria-label={opened ? `${year}학년 과목 접기` : `${year}학년 과목 ${fit.hidden}개 더보기`}
          onClick={() => setOpened((o) => !o)}
        >
          {opened ? "접기" : `더보기 (+${fit.hidden})`}
          <svg width="10" height="6" viewBox="0 0 10 6" className={`transition-transform duration-300 ${opened ? "rotate-180" : ""}`} aria-hidden>
            <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </>
  );
}

/**
 * 학과 상세의 학년별 과목 칩. 누를 수 없는 글 목록이다. 체험으로 고를 수 있는 과목(open)을 민트 칩으로 먼저 두고,
 * 그 밖의 편성 과목은 흰 칩으로 둔다. 학년마다 따로 접고 펼친다.
 */
function YearSubjects({ years, required }) {
  return (
    <div className="grid gap-[16px]">
      {years.map(({ year, open, others }) => (
        <section key={year} aria-label={`${year}학년 과목`}>
          <span className="inline-flex h-[28px] w-[47px] items-center justify-center rounded-full border border-mint text-[13px] font-semibold text-mint">
            {year}학년
          </span>
          <YearChips
            year={year}
            chips={[...open.map((name) => ({ name, open: true, required: required(name) })), ...others.map((name) => ({ name, open: false, required: required(name) }))]}
          />
        </section>
      ))}
    </div>
  );
}
/** 가장 최근에 입학한 학과의 id. 입학한 학과가 없으면 null. */
function latestJourney(state) {
  return Object.keys(state.journeys).reverse().find((id) => all(state).some((item) => item.id === id && item.school)) ?? null;
}

/**
 * 화면에 필요한 학과나 진행 기록이 없으면 홈으로 돌려보낸다(홈은 학과를 고르는 화면을 보여준다).
 * 뒤에 깔려 있는 화면은 다른 학과를 보는 중일 수 있으므로, 맨 위 화면일 때만 확인한다.
 */
function useGuard(ok, nav, active) {
  useEffect(() => {
    if (active && !ok) nav.reset(["home"]);
  }, [ok, nav, active]);
}

// 마지막 글자에 받침이 있는지. 숫자는 읽는 소리로 본다(영·일·삼·육·칠·팔은 받침이 있다).
const hasBatchim = (word) => {
  if (/[0-9]$/.test(word)) return "013678".includes(word[word.length - 1]);
  const code = word.charCodeAt(word.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
};
const josa = (word, withBatchim, without) => word + (hasBatchim(word) ? withBatchim : without);

const DAYS = "일월화수목금토";
const stamp = (date) =>
  `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${DAYS[date.getDay()]}) ${
    date.getHours() < 12 ? "오전" : "오후"
  } ${date.getHours() % 12 || 12}시`;

/* ------------------------------------------------------------------ */
/* 01 · 스플래시                                                       */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* 02 · 학교(캠퍼스) 고르기                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* 03 · 학과 카드                                                      */
/* ------------------------------------------------------------------ */
/* 03 · 추천 결과 · 학과 고르기                                        */
/* ------------------------------------------------------------------ */

function TagPill({ children }) {
  return (
    <span className="flex h-[20px] items-center justify-center whitespace-nowrap rounded-full border border-mint bg-white/40 px-[9px] text-[9px] font-medium text-mint">
      {children}
    </span>
  );
}

// 학과 카드(탐색 탭): 학교·학과 이름, 학과가 있는 건물, 소개.
function DepartmentCard({ top, d, onClick, wait }) {
  return (
    <button
      onClick={onClick}
      className="pressable a-up absolute left-[20px] h-[104px] w-[362px] rounded-[16px] border border-cream-line bg-cream text-left active:bg-cream-2"
      style={{ top, ...delay(wait) }}
    >
      <T y={18} size={16} left={15.5} clip={330} className="font-semibold text-slate">
        {`${d.school} ${d.name}`}
      </T>
      <span className="absolute left-[15px] top-[46px] flex max-w-[330px] items-center gap-[4px] text-[12px] font-semibold text-mint-deep">
        <svg width="10" height="13" viewBox="0 0 10 13" aria-hidden>
          <path d="M5 12.5S.8 7.6.8 4.9a4.2 4.2 0 0 1 8.4 0C9.2 7.6 5 12.5 5 12.5Z" fill="currentColor" />
          <circle cx="5" cy="4.8" r="1.6" fill="#fffaea" />
        </svg>
        <span className="truncate">{d.building ? `국제캠퍼스 ${d.building}` : "국제캠퍼스"}</span>
      </span>
      <T y={70} size={11} left={16} clip={330} className="text-gray">
        {d.intro}
      </T>
    </button>
  );
}

// 학과를 열어 본다(학과 상세).
const openDepartment = (nav, setState, d) => {
  setState((s) => ({ ...s, current: d.id }));
  nav.push("detail");
};

/**
 * 학과 고르기: 학과 카드 목록(탐색 탭). 학과 데이터를 받는 중이거나 받지 못했으면 그 상태를 보여준다.
 */
const CARD_GAP = 118;
function pickerHeight(count) {
  return count * CARD_GAP;
}
function DepartmentPicker({ top, nav, state, setState, catalog }) {
  const list = all(state);
  if (!list.length)
    return catalog.status === "error" ? (
      <div className="a-up absolute left-[20px] w-[362px]" style={{ top }} role="alert">
        <p className="body-copy">{catalog.message}</p>
        <button className="button" onClick={catalog.retry}>
          다시 시도
        </button>
      </div>
    ) : (
      <p className="a-fade absolute left-[20px] text-[14px] text-ink-3" style={{ top }} role="status">
        학과 정보를 불러오는 중이에요…
      </p>
    );
  return (
    <>
      {list.map((d, i) => (
        <DepartmentCard key={d.id} top={top + i * CARD_GAP} d={d} wait={0.1 + i * 0.06} onClick={() => openDepartment(nav, setState, d)} />
      ))}
    </>
  );
}

// 예전 탐색 탭(학과 둘러보기). 탐색은 홈으로 합쳤으므로, 저장된 화면 기록 등으로 여기에 오면 홈의 학과 목록으로 보낸다.
export function Departments({ nav, active }) {
  useEffect(() => {
    if (active) nav.reset([["home", { focus: "departments" }]]);
  }, [active, nav]);
  return null;
}

/* ------------------------------------------------------------------ */
/* 08 · 학과 상세                                                      */
/* ------------------------------------------------------------------ */

/** 입학증·성적표·졸업증명서의 도장. 위치와 크기는 세 화면이 같고, 등장 모션은 화면마다 넘겨받는다. */
function SchoolSeal({ d, className, style }) {
  return (
    <div className={`${className} absolute left-[112px] top-[308px] h-[40px] w-[53px]`} style={style}>
      <SchoolLogo school={d.school} kind="seal" size={40} />
    </div>
  );
}

function Palette() {
  return (
    <svg viewBox="0 0 140 140" className="loop h-full w-full" style={{ animation: "blob 6s ease-in-out infinite", filter: "blur(3.5px)" }}>
      <path
        d="M70 10C36 10 10 36 10 68c0 34 28 62 60 62 10 0 14-6 14-12 0-8-8-10-8-18 0-6 5-10 12-10h12c19 0 30-14 30-32C130 32 104 10 70 10Z"
        fill="none"
        stroke="#7fe6de"
        strokeWidth="11"
        strokeLinejoin="round"
      />
      <circle cx="44" cy="52" r="8.5" fill="#86e7e0" />
      <circle cx="70" cy="36" r="7" fill="#86e7e0" />
      <circle cx="98" cy="50" r="9" fill="#86e7e0" />
      <circle cx="36" cy="82" r="9" fill="#86e7e0" />
    </svg>
  );
}

export function Detail({ active, nav, state, setState }) {
  const v = view(state);
  useGuard(!!v, nav, active);
  // 학년별 과목 목록은 길이가 정해져 있지 않아(더 보기, 긴 이름) 그려진 높이를 재서 화면 높이를 정한다.
  const list = useRef(null);
  const [listH, setListH] = useState(0);
  useLayoutEffect(() => {
    if (!list.current) return;
    const update = () => setListH(list.current?.offsetHeight || 0);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list.current);
    return () => observer.disconnect();
  }, [!!v]);
  if (!v) return null;
  const { d, journey, progress } = v;
  const finished = progress.graduated;
  const enroll = () => {
    setState((s) => ({ ...s, studying: d.id }));
    if (journey) return nav.reset(["home", "major"]);
    setState((s) => ({ ...s, journeys: { ...s.journeys, [d.id]: {} } }));
    nav.push("enrolled", undefined, "rise");
  };
  const subjects = Object.values(d.years).flat();
  return (
    <Screen
      h={Math.max(600, 528 + listH + 32)}
      footer={
        <OutlineButton onClick={enroll} className="a-up" style={delay(0.5)}>
          {finished ? "졸업한 학과 · 이어서 체험하기" : journey ? "이어서 체험하기" : `${d.name} 입학하기`}
        </OutlineButton>
      }
    >
      <BackButton onClick={nav.back} />
      <div className="a-up absolute left-[20px] top-[116px] h-[112px] w-[362px] rounded-[16px] border border-cream-line bg-cream">
        <div className="absolute left-[11px] top-[21px] h-[72px] w-[108px]">
          <SchoolLogo school={d.school} />
        </div>
        <T y={27} size={21} left={135.5} className="flex items-center gap-[6px] font-semibold text-slate" style={{ maxWidth: 215 }}>
          <span className="min-w-0 truncate">{d.school}</span>
        </T>
        <T y={57} size={11} lh={17} left={135} clip={215} className="text-gray">
          {`${d.officialName}\n수업연한 ${d.duration} 과정`}
        </T>
      </div>
      <div
        className="a-up absolute left-[20px] top-[247px] h-[168px] w-[362px] overflow-hidden rounded-[16px] border border-mint"
        style={{ background: "linear-gradient(180deg, #f6fdfd 0%, #d6f8f6 100%)", animationDelay: "0.08s" }}
      >
        <div className="absolute left-[218px] top-[14px] h-[140px] w-[140px] opacity-90">
          <Palette />
        </div>
        <T y={22.5} size={12} left={17.5} className="font-medium text-mint">
          {groupName(d.studyGroup)} 분야
        </T>
        <T y={54} size={21} left={17.5} clip={330} className="font-semibold text-slate">
          {d.name}
        </T>
        <div className="report-text absolute left-[17px] top-[79px] w-[250px] text-[11.5px] leading-[17px] text-gray" style={{ WebkitLineClamp: 2 }}>
          {d.intro}
        </div>
        <div className="absolute left-[17px] top-[136px] flex gap-[8px]">
          <TagPill>{`${d.duration} · 학년별 체험`}</TagPill>
          {d.tags.map((tag) => (
            <TagPill key={tag}>{tag}</TagPill>
          ))}
        </div>
      </div>
      <T y={441} size={16} left={33} className="a-up font-semibold text-slate" style={delay(0.16)}>
        이 학과는 이런 내용을 배워요
      </T>
      <T y={472.5} size={14} lh={20} left={33} clip={340} className="a-up text-slate/90" style={delay(0.2)}>
        {`필수과목을 B- 이상으로 이수하면 다음 학년이 열려요\n민트색은 체험할 수 있고, 나머지는 구현 예정이에요 (${subjects.length}과목)`}
      </T>
      <div ref={list} className="a-up absolute left-[20px] right-[20px] top-[528px]" style={delay(0.28)}>
        <YearSubjects years={yearSubjects(d)} required={(subject) => isRequired(d, subject)} />
        <p className="footnote">
          {`출처: ${d.school} `}
          {d.source.url ? (
            <a href={d.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-[2px]">
              {d.source.title || "교육과정 편성표"}
            </a>
          ) : (
            d.source.title
          )}
          {". 필수는 편성표의 전공기초·전공필수예요. 4학년에는 졸업 과제를 해요."}
        </p>
        <button className="text-button mt-[14px] block" onClick={() => nav.push("community", { tab: "questions", dept: d.id })}>
          이 학과 질문 보러가기 →
        </button>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 09 / 14 / 16 · 입학증 · 성적표 · 졸업증명서                         */
/* ------------------------------------------------------------------ */

function useAutoAdvance(fn, ms) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const t = window.setTimeout(() => ref.current(), ms);
    return () => window.clearTimeout(t);
  }, [ms]);
}

function PaperRow({ y, left, right, lineFrom = 24, lineTo = 255, d = 0 }) {
  return (
    <div className="a-fade pointer-events-none absolute inset-0" style={delay(d)}>
      <T y={y} size={11.5} left={26.5} className="text-gray">
        {left}
      </T>
      <T y={y} size={11.5} right={273 - 255.5} clip={185} className="text-gray">
        {right}
      </T>
      <span
        className="absolute h-px origin-left bg-[#c8c8c8]"
        style={{ top: y + 17.5, left: lineFrom, width: lineTo - lineFrom, animation: `line-grow 0.6s cubic-bezier(0.22,1,0.36,1) ${d + 0.05}s both` }}
      />
    </div>
  );
}

function CertificateShell({ onBack, onNext, children }) {
  return (
    <Screen bg="#27d8cd">
      <BackButton onClick={onBack} color="#fff" />
      <button aria-label="다음으로" onClick={onNext} className="absolute inset-0 top-[100px] z-0 cursor-pointer" />
      <Center>
        <Paper className="a-paper z-10 shadow-[0_18px_40px_rgba(0,80,76,0.18)]" style={delay(0.05)}>
          <PaperFold src={img.paperFold} />
          {children}
        </Paper>
      </Center>
    </Screen>
  );
}

/** 종이에 적는 증명 문구. 학교·학과 이름이 길어도 종이 안에서 줄바꿈된다. */
function Statement({ y, d, children }) {
  return (
    <div
      className="a-fade absolute left-[22px] right-[22px] whitespace-pre-line text-center text-[11px] leading-[21px] text-gray"
      style={{ top: y, wordBreak: "keep-all", ...delay(d) }}
    >
      {children}
    </div>
  );
}

export function Enrolled({ active, nav, state }) {
  const v = view(state);
  const [now] = useState(() => new Date());
  const next = () => nav.replace("welcome", undefined, "fade");
  useGuard(!!v, nav, active);
  useAutoAdvance(next, 4200);
  if (!v) return null;
  const { d } = v;
  return (
    <CertificateShell onBack={nav.back} onNext={next}>
      <T y={56} size={25} center className="a-up pl-[8px] font-bold text-mint" style={delay(0.45)}>
        입학을 축하합니다!
      </T>
      <PaperRow y={117} left="체험생" right={`${d.school} ${d.name}`} d={0.6} />
      <PaperRow y={165} left="일시" right={stamp(now)} d={0.72} />
      <Statement y={210} d={0.9}>
        {`위 사람은 ${d.school} ${d.name}의\n진로 체험을 시작할 수 있음을 증명합니다`}
      </Statement>
      <SchoolSeal d={d} className="a-pop" style={delay(1.1)} />
    </CertificateShell>
  );
}

function BottomSign({ d: department, wait }) {
  return (
    <div className="a-fade pointer-events-none absolute inset-0" style={delay(wait)}>
      <T y={288.5} size={10} left={48} className="text-gray">
        체험생
      </T>
      <T y={288.5} size={10} right={40} clip={150} className="text-gray">
        {department.school} {department.name}
      </T>
      <span
        className="absolute left-[42px] top-[309.5px] h-px w-[190.5px] origin-left bg-[#c8c8c8]"
        style={{ animation: `line-grow 0.6s cubic-bezier(0.22,1,0.36,1) ${wait}s both` }}
      />
    </div>
  );
}

export function Grades({ active, nav, state }) {
  const v = view(state);
  const next = () => nav.replace("diploma", undefined, "fade");
  const ok = !!v?.progress.graduated;
  useGuard(ok, nav, active);
  useAutoAdvance(next, 4600);
  if (!ok) return null;
  const { d, progress } = v;
  // 들은 과목을 필수부터, 학년 순서로 적는다. 종이에 다 들어가지 않으면 "외 N과목"으로 줄인다.
  const taken = [...progress.taken].sort((a, b) => b.required - a.required || a.year - b.year);
  const shown = taken.slice(0, 7);
  const average = averagePoint(taken.map((course) => course.record.grade));
  const perfect = taken.every((course) => course.record.grade === "A+" || course.record.grade === PASS);
  return (
    <CertificateShell onBack={() => nav.reset(["home"])} onNext={next}>
      <div className="absolute inset-0 overflow-hidden rounded-[8px]">
        <T y={56} size={25} center className="a-up pl-[8px] font-bold text-mint" style={delay(0.45)}>
          성적표
        </T>
        <Statement y={98} d={0.6}>
          {`위 사람은 ${d.school} ${d.name}의\n체험 과정을 모두 마쳤음을 증명합니다`}
          <span className="block text-[10.5px] leading-[18px] text-mint-deep">
            {`이수 ${progress.passedCount}과목${average === null ? "" : ` · 평균 평점 ${average.toFixed(2)} / 4.5`}`}
          </span>
        </Statement>
        <ul className="a-fade absolute left-[26px] top-[164px] w-[222px]" style={delay(0.7)} aria-label="과목별 성적">
          {shown.map((course) => (
            <li key={course.subject} className="flex gap-[6px] text-[10px] leading-[16px] text-gray">
              <span className="shrink-0 tabular-nums text-mint-deep">{course.year}학년</span>
              <span className="min-w-0 flex-1 truncate">{course.subject}</span>
              <span className="shrink-0 font-semibold text-ink-2">{course.record.grade}</span>
            </li>
          ))}
          {taken.length > shown.length && <li className="text-[10px] leading-[16px] text-gray">{`외 ${taken.length - shown.length}과목`}</li>}
        </ul>
        <BottomSign d={d} wait={0.7} />
        <SchoolSeal d={d} className="a-fade" style={delay(0.8)} />
        {perfect && (
          <img
            src={img.gradeAplus}
            alt="모두 A+"
            className="absolute left-[-4px] top-[141px] h-[191px] w-[166px]"
            style={{ animation: "stamp 0.55s cubic-bezier(0.22,1,0.36,1) 1.05s both" }}
          />
        )}
        <img
          src={img.gradeSign}
          alt=""
          className="absolute left-[131px] top-[256px] h-[72px] w-[130px]"
          style={{ animation: "wipe 0.75s cubic-bezier(0.65,0,0.35,1) 1.75s both" }}
        />
      </div>
    </CertificateShell>
  );
}

export function Diploma({ active, nav, state }) {
  const v = view(state);
  const next = () => nav.replace("graduation", undefined, "fade");
  const ok = !!v?.progress.graduated;
  useGuard(ok, nav, active);
  useAutoAdvance(next, 4200);
  if (!ok) return null;
  const { d } = v;
  return (
    <CertificateShell onBack={() => nav.reset(["home"])} onNext={next}>
      <T y={56} size={25} center className="a-up pl-[8px] font-bold text-mint" style={delay(0.45)}>
        졸업증명서
      </T>
      <PaperRow y={117} left="체험생" right={`${d.school} ${d.name}`} d={0.6} />
      <Statement y={168} d={0.8}>
        {`위 사람은 ${d.school} ${d.name}\n체험 과정을 졸업하였음을 증명합니다`}
      </Statement>
      <BottomSign d={d} wait={0.95} />
      <SchoolSeal d={d} className="a-pop" style={delay(1.15)} />
    </CertificateShell>
  );
}

/* ------------------------------------------------------------------ */
/* 10 · 환영                                                           */
/* ------------------------------------------------------------------ */

export function Welcome({ active, nav, state }) {
  const v = view(state);
  useGuard(!!v?.journey, nav, active);
  if (!v?.journey) return null;
  const { d } = v;
  // 화면이 낮으면 캐릭터를 줄여서(최대 150) 그 아래 인사와 1학년 안내가 버튼에 가려지지 않게 올린다.
  const shrink = "min(150px, var(--cut) * 1px)";
  return (
    <Screen
      h={`725px - ${shrink}`}
      foot={725}
      footer={
        <>
          <button
            onClick={() => nav.reset(["home", "major"], "fade")}
            className="pressable a-up absolute left-[20px] top-[737px] flex h-[67px] w-[362px] items-center justify-center rounded-[14px] bg-mint text-[18px] font-semibold text-white active:brightness-95"
            style={delay(0.9)}
          >
            첫 과제 시작하기
          </button>
          <T y={820} size={11.5} center className="a-fade text-ink-3" style={delay(1)}>
            학년은 체험 단계예요. 내 속도에 맞춰 진행해요.
          </T>
        </>
      }
    >
      <button aria-label="뒤로" onClick={nav.back} className="pressable absolute left-[17px] top-[48px] z-20 flex h-[40px] w-[36px] items-center justify-center">
        <Mask src={icon.back} w={10} h={15} color="#2c1502" />
      </button>
      <T y={61} size={14.5} center className="font-bold text-ink">
        체험 입학
      </T>
      <div
        className="a-pop absolute left-[141px] top-[121px] flex h-[36px] w-[120px] items-center justify-center gap-[4px] rounded-full border border-mint bg-mint-soft text-[14px] font-bold text-mint-deep"
        style={delay(0.15)}
      >
        체험 입학 완료
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden>
          <path d="M1.2 4.6 4 7.3 9.8 1.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="a-drop absolute left-1/2 top-[171px] aspect-[244/252] -translate-x-1/2" style={{ height: `calc(252px - ${shrink})`, ...delay(0.3) }}>
        <img
          src={img.mascotWelcome}
          alt=""
          className="loop h-full w-full"
          style={{ animation: "hop 2.4s ease-in-out 1.3s infinite", transformOrigin: "50% 100%" }}
        />
      </div>
      <div className="absolute inset-x-0 top-0" style={{ top: `calc(-1 * ${shrink})` }}>
        <T y={458} size={d.name.length > 9 ? 21 : 28.5} lh={42} center clip={380} className="a-up font-bold text-ink" style={delay(0.6)}>
          {`반가워요,\n${d.name} 새내기!`}
        </T>
        <T y={549.5} size={14.5} center className="a-up text-ink-3" style={delay(0.7)}>
          나에게 맞는 전공인지, 직접 경험하며 알아봐요.
        </T>
        <div className="a-up absolute left-0 top-[603px] h-[115px] w-[402px] rounded-[28px] bg-cream-2" style={delay(0.8)}>
          <T y={27} size={16.5} center clip={360} className="font-bold text-ink-2">
            {`1학년 과목 ${d.years[1].length}개 · 필수 ${d.years[1].filter((subject) => isRequired(d, subject)).length}개`}
          </T>
          <T y={62.5} size={13.5} lh={20} center className="text-ink-3">
            {"필수과목을 B- 이상으로 이수하면 다음 학년이 열려요.\n4학년에는 졸업 과제에 도전해요."}
          </T>
        </div>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 11 · 홈                                                             */
/* ------------------------------------------------------------------ */

function useCountUp(target, ms = 1100, startDelay = 400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + startDelay;
    const tick = (now) => {
      const p = Math.min(1, Math.max(0, (now - t0) / ms));
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, startDelay]);
  return value;
}

// 하단 탭바. 민트 윗선부터 아이콘·라벨까지 TAB_BAR(80), 그 아래 TRIM_BOTTOM(28, 홈 인디케이터 자리, App.jsx에서 화면이
// 낮으면 먼저 줄어든다)을 더한 높이를 아트보드 아래에 붙인다. 탭바를 쓰는 화면은 foot={TAB_TOP}을 주고,
// 아래를 가리지 않게 TAB_H(- var(--bt))만큼 비운다.
const TAB_BAR = 80;
const TAB_H = TAB_BAR + 28;
const TAB_TOP = 874 - TAB_H;
const TABS = [
  { id: "home", label: "홈", icon: icon.home, w: 38, h: 38, cx: 52 },
  { id: "major", label: "전공", icon: icon.major, w: 37, h: 39, cx: 145 },
  { id: "community", label: "커뮤니티", icon: icon.community, w: 39, h: 39, cx: 242.5 },
  { id: "my", label: "마이페이지", icon: icon.my, w: 40, h: 39, cx: 336 },
];

function TabBar({ active, nav, state }) {
  const go = (id) => {
    if (id === active) return;
    if (id === "home") nav.reset(["home"]);
    // 전공: 지금 체험 중인 학과의 홈. 입학한 학과가 없으면 그 화면이 안내를 보여준다.
    if (id === "major") nav.push("major");
    if (id === "community") nav.push("community");
    if (id === "my") nav.push("my");
  };
  return (
    <div className="absolute left-0 w-full border-t border-mint bg-white" style={{ top: TAB_TOP, height: TAB_H }}>
      {TABS.map((t) => {
        const on = t.id === active;
        // 아이콘(39px 칸) + 4px + 라벨(15px)을 위 여백 10px로 쌓는다(아래 여백은 남는 12px).
        return (
          <button
            key={t.id}
            onClick={() => go(t.id)}
            aria-current={on ? "page" : undefined}
            className="pressable absolute flex flex-col items-center gap-[4px] pt-[10px]"
            style={{ left: t.cx - 44, top: 0, width: 88, height: TAB_BAR }}
          >
            <span className="flex h-[39px] items-center justify-center">
              <Mask src={t.icon} w={t.w} h={t.h} color={on ? "#27d8cd" : "#c4c4c4"} />
            </span>
            <span className={`text-[12.5px] font-medium leading-[15px] ${on ? "text-mint" : "text-[#c4c4c4]"}`}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// 체험의 이름: 졸업 과제, 전공 실습(예: 순서 맞추기), 연습 문제 유형(예: 이론 퀴즈).
const experienceName = (d, id) =>
  id === "final"
    ? "졸업 과제"
    : id.startsWith("lab:")
      ? "실습 과제"
      : id.startsWith("group:") && d.practice
        ? `전공 실습(${templates[d.practice.template].title})`
        : lessonTypes[id]?.title || "";

/** 들어야 할 과목 카드. 성적이 있으면 재수강이 필요하다고 알린다. */
function CourseCard({ top, d, course, wait, onClick }) {
  const sub = course.record
    ? `${course.record.grade} · ${PASS_GRADE} 이상이어야 이수돼요 · 재수강`
    : course.final
      ? `졸업 과제 · ${d.final.name}`
      : `${course.year}학년 · ${course.kind} · ${experienceName(d, gameOf(d, course.subject))}`;
  return (
    <button
      onClick={onClick}
      aria-label={`${course.subject}, ${sub}, 듣기`}
      className="pressable a-up absolute left-[21px] flex h-[69px] w-[365px] items-center gap-[10px] rounded-[10px] border border-mint bg-white pl-[16px] pr-[14px] text-left"
      style={{ top, animationDelay: `${wait}s` }}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-semibold leading-[20px] text-ink-2">{course.subject}</span>
        <span className="truncate text-[10.5px] leading-[16px] text-ink-3">{sub}</span>
      </span>
      <span className="flex h-[24px] shrink-0 items-center rounded-full bg-mint-soft px-[10px] text-[12px] font-semibold text-mint-deep">
        {course.record ? "재수강" : "듣기"}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 11 · 홈: 국제캠퍼스 지도                                            */
/* ------------------------------------------------------------------ */

/** 크레딧 표시(모든 학과 공용). */
function CreditPill({ credits, className = "", style }) {
  return (
    <span
      className={`flex h-[28px] items-center gap-[5px] rounded-full border border-mint bg-mint-soft px-[10px] text-[12.5px] font-bold text-mint-deep ${className}`}
      style={style}
      aria-label={`크레딧 ${credits}`}
    >
      <span className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-sun text-[10px] font-extrabold text-ink" aria-hidden>
        C
      </span>
      {credits.toLocaleString()}
    </span>
  );
}

// 학과의 진행 상태 한 줄.
function journeyText(state, d) {
  if (!state.journeys[d.id]) return "아직 입학 전이에요";
  const progress = progressOf(state, d);
  return progress.graduated ? `졸업 · 이수 ${progress.passedCount}과목` : `${progress.openYear}학년 진행 중 · 이수 ${progress.passedCount}과목`;
}

// 지도 아래에서 캐릭터가 하는 말: 처음 도착, 잠긴 건물 안내, 학과 정보 상태, 지금 체험 중인 학과의 진행 상황.
function guideLine({ landing, hint, list, catalog, studying, progress }) {
  if (hint) return hint;
  if (!list.length) return catalog.status === "error" ? catalog.message : "학과 정보를 불러오는 중이에요…";
  if (landing) return `${CAMPUS.school} ${CAMPUS.name}에 도착했어요! 핀이 꽂힌 건물을 눌러 학과를 골라 봐요.`;
  if (!studying) return "핀이 꽂힌 민트색 건물에 학과가 있어요. 눌러서 구경해 봐요!";
  if (progress.graduated) return `${studying.name} 졸업을 축하해요! 남은 과목도 계속 들을 수 있고, 다른 건물도 둘러볼 수 있어요.`;
  const now = progress.years[progress.openYear - 1];
  return progress.openYear < 4
    ? `${studying.name} ${progress.openYear}학년이에요. ${progress.openYear + 1}학년까지 남은 필수과목 ${now.left.length}개!`
    : `${studying.name} 4학년이에요. 졸업까지 조금만 더 힘내요!`;
}

// 홈 지도 영역(지도 + 캐릭터 줄)의 높이: 탭바 위까지에서 PEEK만큼 덜어 아래 '학과 둘러보기' 제목이 살짝 보이게 한다.
const HOME_TOP = 164;
// 학과 둘러보기 제목 높이.
const DEPT_HEAD = 44;
const PEEK = 34;
const HOME_FOLD = `calc((var(--vh) + var(--tt) + var(--bt) - ${TAB_H} - ${PEEK}) * 1px)`;

export function Home({ nav, route, state, setState, catalog }) {
  const list = all(state);
  // 예전 탐색 탭으로 오던 링크는 홈의 학과 목록으로 내려 보여준다.
  const listTop = useRef(null);
  const focusList = route?.params?.focus === "departments";
  useEffect(() => {
    if (focusList) listTop.current?.scrollIntoView({ block: "start" });
  }, [focusList]);
  // 처음 도착했으면 캐릭터가 지도 아래로 떨어진다(한 번만).
  const [landing] = useState(() => !state.introSeen);
  useEffect(() => {
    if (landing) setState((s) => ({ ...s, introSeen: true }));
  }, [landing, setState]);
  // 누른 건물(학과를 고르는 창)과, 잠긴 건물을 눌렀을 때 캐릭터가 하는 말.
  const [building, setBuilding] = useState(null);
  const [hint, setHint] = useState("");
  const hintTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(hintTimer.current), []);
  const locked = (name) => {
    setHint(`${josa(name, "은", "는")} 아직 준비 중이에요. 핀이 꽂힌 민트색 건물을 눌러 봐요!`);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(""), 3200);
  };
  const open = (d) => {
    setBuilding(null);
    setState((s) => ({ ...s, current: d.id }));
    nav.push(state.journeys[d.id] ? "major" : "detail");
  };
  // 지금 체험 중인 학과(홈에 보여 주던 학과, 없으면 가장 최근에 입학한 학과).
  const studyingId = state.journeys[state.studying] ? state.studying : latestJourney(state);
  const studying = list.find((d) => d.id === studyingId) || null;
  const progress = studying ? progressOf(state, studying) : null;
  // 처음에는 체험 중인 학과의 건물(없으면 열린 건물들 한가운데)이 지도 틀 가운데 오게 둔다. 핀부터 이름표까지가 가운데 오게 조금 내린다.
  const home = studying && PLACES.find((place) => place.kind === "college" && place.name === studying.building);
  const opened = home ? [home] : PLACES.filter((place) => place.kind === "college" && departmentsIn(list, place.name).length);
  const center = opened.length ? (Math.min(...opened.map((p) => p.x)) + Math.max(...opened.map((p) => p.x))) / 2 : 0.5;
  const middle = opened.length ? (Math.min(...opened.map((p) => p.y)) + Math.max(...opened.map((p) => p.y))) / 2 : 0.5;
  const line = guideLine({ landing, hint, list, catalog, studying, progress });
  // 캐릭터는 체험 중인 학과의 학년에 따라 자란다(입학 전이면 새내기).
  const character = yearCharacter(progress?.openYear || 1);
  const continueStudy = () => {
    setState((s) => ({ ...s, current: studying.id }));
    nav.push("major");
  };
  const inside = building ? departmentsIn(list, building) : [];
  const sheet = building && (
    <Dialog title={building} onClose={() => setBuilding(null)} actions={<button className="button ghost" onClick={() => setBuilding(null)}>닫기</button>}>
      <p className="text-[13px] leading-[20px] text-ink-3">이 건물에 있는 학과예요.</p>
      <ul className="mt-[12px] grid gap-[8px]">
        {inside.map((d) => (
          <li key={d.id}>
            <button onClick={() => open(d)} className="pressable w-full rounded-[14px] border border-cream-line bg-cream px-[14px] py-[12px] text-left active:bg-cream-2">
              <span className="block truncate text-[15px] font-semibold text-slate">{d.name}</span>
              <span className="mt-[2px] block text-[12px] leading-[18px] text-gray">{journeyText(state, d)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
  return (
    <Screen
      h={`calc((var(--vh) + var(--tt) + var(--bt) - ${TAB_H} - ${PEEK} + ${DEPT_HEAD + Math.max(pickerHeight(list.length), 60) + 16}) * 1px)`}
      foot={TAB_TOP}
      veil={false}
      overlay={sheet}
      footer={<TabBar active="home" nav={nav} state={state} />}
    >
      <Mask src={icon.cap} w={24} h={18} color="#087f77" className="absolute left-[23px] top-[59px]" />
      <button
        onClick={() => nav.push("school", { change: true })}
        aria-label={`${CAMPUS.school} ${CAMPUS.name}, 학교 바꾸기`}
        className="pressable absolute left-[52px] top-[52px] flex h-[36px] max-w-[250px] items-center gap-[4px] rounded-full px-[4px] text-[16px] font-semibold text-mint"
      >
        <span className="truncate">{`${CAMPUS.school} ${CAMPUS.name}`}</span>
        <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden>
          <path d="M1.5 1.5 6 6l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <CreditPill credits={state.credits || 0} className="absolute right-[20px] top-[55px]" />
      <T y={100} size={26} lh={34} left={20} className="a-up font-bold text-navy">
        어느 건물로 가볼까요?
      </T>
      <T y={140} size={13} left={20.5} clip={360} className="a-up text-gray" style={delay(0.06)}>
        지도를 밀어 캠퍼스를 둘러봐요.
      </T>
      {/* 지도와 그 바로 밑의 캐릭터·말풍선 줄. 탭바 위까지의 높이에 맞춰, 화면이 낮으면 지도 보이는 영역이 줄어든다
          (줄어든 만큼은 지도를 위아래로 밀어 본다). 캐릭터·말풍선 줄은 높이가 정해져 있어서 말이 바뀌어도 지도 크기가
          변하지 않고, 지도 위로는 그려지지 않는다(처음 도착할 때 떨어지는 캐릭터도 이 줄 안에서만 보인다).
          캐릭터와 말풍선은 세로 가운데로 맞추고, 캐릭터는 지도와 약 20px 떨어진다(줄 위 여백 8 + 가운데 맞춤 12). */}
      <div className="absolute inset-x-0 isolate flex flex-col" style={{ top: HOME_TOP, height: `calc(${HOME_FOLD} - ${HOME_TOP}px)` }}>
        <div className="min-h-[120px] flex-1 px-[16px] pt-[14px]" style={{ maxHeight: MAP_H + 2 + 14 }}>
          {/* 지도 틀은 화면 안에 고정되고(네 모서리가 늘 보인다), 그보다 큰 지도 그림만 틀 안에서 끌어 본다. */}
          <PanView
            width={MAP_W}
            height={MAP_H}
            focus={[center * MAP_W, middle * MAP_H + 10]}
            label={`${CAMPUS.name} 지도. 끌거나 화살표 키로 둘러봐요.`}
            className="h-full rounded-[24px] border border-[#cfe5c6] bg-[#cdeac2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint-deep"
          >
            <CampusMap departments={list} onOpen={setBuilding} onLocked={locked} />
          </PanView>
        </div>
        <div className="flex h-[112px] shrink-0 items-center gap-[10px] py-[8px] pl-[16px] pr-[18px]" style={{ clipPath: "inset(0 -24px -24px -24px)" }}>
          <div className="relative h-[72px] w-[72px] shrink-0">
            <span className="a-fade absolute bottom-[-2px] left-[8px] h-[10px] w-[56px] rounded-[50%] bg-[rgba(20,60,40,0.14)]" style={delay(landing ? 1 : 0)} aria-hidden />
            <img
              key={character.src}
              src={character.src}
              alt={character.alt}
              className={`relative h-full w-full object-contain ${landing ? "a-fall" : "loop"}`}
              style={landing ? undefined : { animation: "hop 2.6s ease-in-out 0.6s infinite", transformOrigin: "50% 100%" }}
            />
          </div>
          <div
            key={line}
            role="status"
            className="a-pop relative min-w-0 flex-1 rounded-[16px] border border-mint bg-white px-[14px] py-[10px] shadow-[0_6px_16px_rgba(8,127,119,0.12)]"
            style={delay(landing && !hint ? 1.1 : 0)}
          >
            <span className="absolute left-[-8px] top-1/2 -mt-[7px] h-[14px] w-[14px] rotate-45 border-b border-l border-mint bg-white" aria-hidden />
            <p className="relative text-[12.5px] leading-[18px] text-ink-2">{line}</p>
            {!list.length && catalog.status === "error" && (
              <button className="text-button relative mt-[2px]" onClick={catalog.retry}>
                다시 시도 →
              </button>
            )}
            {list.length > 0 && !hint && !landing && studying && (
              <button className="text-button relative mt-[2px] max-w-full truncate" onClick={continueStudy}>
                {`${studying.name} 이어서 하기 →`}
              </button>
            )}
          </div>
        </div>
      </div>
      {/* 지도 아래: 학과 둘러보기(예전 탐색 탭). 위로 밀면 이어서 보인다. */}
      <section
        ref={listTop}
        aria-labelledby="home-departments"
        className="absolute inset-x-0 scroll-mt-[60px]"
        style={{ top: HOME_FOLD, height: DEPT_HEAD + Math.max(pickerHeight(list.length), 60) }}
      >
        <h2 id="home-departments" className="absolute left-[20px] top-[8px] text-[17px] font-bold leading-[24px] text-navy">
          학과 둘러보기
        </h2>
        <DepartmentPicker top={DEPT_HEAD} nav={nav} state={state} setState={setState} catalog={catalog} />
      </section>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 11-1 · 학과 홈: 입학한 학과의 진행 상황                              */
/* ------------------------------------------------------------------ */

const SHOWN_TODO = 3;

export function Major({ active, nav, state, setState }) {
  const v = view(state);
  // 탐색에서 다른 학과를 열어 보면 current가 그 학과로 바뀐다. 그 학과에 입학하지 않은 채 홈으로 돌아오면
  // 홈에 보여 주던 학과(없으면 가장 최근에 입학한 학과)를 다시 보여준다.
  // 홈이 뒤에 깔려 있는 동안(탐색·학과 상세를 보는 중)에는 건드리지 않는다. 건드리면 열어 본 학과가 진행 중인 학과로 바뀐다.
  const fallback = v?.journey ? null : state.journeys[state.studying] ? state.studying : latestJourney(state);
  const shown = v?.journey ? v.d.id : null;
  useEffect(() => {
    if (!active) return;
    if (fallback) setState((s) => ({ ...s, current: fallback }));
    else if (shown && state.studying !== shown) setState((s) => ({ ...s, studying: shown }));
  }, [active, fallback, shown, state.studying, setState]);
  // 다음 학년 해금(4학년이면 졸업)까지: 지금 학년 필수과목 중 이수한 비율.
  const step = v?.journey ? nextStepOf(v.progress) : null;
  const percent = step ? step.percent : 0;
  const pct = useCountUp(percent);
  // 입학한 학과가 하나도 없으면 안내와 함께 학과를 고르러 갈 수 있게 한다.
  if (!v?.journey && !fallback)
    return (
      <Screen foot={TAB_TOP} veil={false} footer={<TabBar active="major" nav={nav} state={state} />}>
        <Header title="나의 전공" />
        <div className="a-pop absolute left-[121px] top-[176px] h-[160px] w-[160px]" style={delay(0.05)}>
          <img src={yearCharacter(1).src} alt="" className="loop h-full w-full object-contain" style={{ animation: "float 2.6s ease-in-out 0.9s infinite" }} />
        </div>
        <T y={370} size={22} center className="a-up font-bold text-navy" style={delay(0.15)}>
          아직 체험 중인 전공이 없어요
        </T>
        <T y={408} size={14} lh={22} center clip={340} className="a-up text-gray" style={delay(0.22)}>
          {"캠퍼스 지도에서 건물을 골라 학과에 체험 입학하면\n여기에서 진행 상황과 과목을 볼 수 있어요."}
        </T>
        <FilledButton top={500} onClick={() => nav.reset(["home"])}>
          캠퍼스 지도에서 학과 고르기
        </FilledButton>
        <button className="text-button a-up absolute left-0 right-0 top-[578px] text-center" onClick={() => nav.reset([["home", { focus: "departments" }]])} style={delay(0.3)}>
          학과 목록으로 보기 →
        </button>
      </Screen>
    );
  if (!v?.journey) return null;
  const { d, progress } = v;
  const { openYear, graduated, years, passedCount } = progress;
  const now = years[openYear - 1];
  // 다음 학년(4학년이면 졸업)까지 남은 것: 체험이 있는 필수과목, 4학년이면 졸업 과제까지.
  const finalCourse = years[3].courses.find((course) => course.final);
  // 졸업한 뒤에는 아직 안 들은 체험 과목(모든 학년)을 보여 주고 계속 들을 수 있게 한다.
  const untaken = years.flatMap((item) => item.courses).filter((course) => !course.planned && !course.record);
  const todo = graduated
    ? untaken
    : [...now.left, ...(openYear === 4 && !finalCourse.passed && !now.left.includes(finalCourse) ? [finalCourse] : [])];
  const shownTodo = todo.slice(0, SHOWN_TODO);
  const open = () => nav.push("courses", { year: graduated ? (untaken[0]?.year ?? 4) : openYear });
  const listEnd = shownTodo.length ? 565 + shownTodo.length * 84 + (todo.length > SHOWN_TODO ? 30 : 0) : 615;
  return (
    <Screen h={listEnd + 24} foot={TAB_TOP} veil={false} footer={<TabBar active="major" nav={nav} state={state} />}>
      <BackButton onClick={() => nav.reset(["home"])} />
      <T y={61} size={16} center clip={220} className="font-semibold text-mint">
        {`${d.school} · ${d.building}`}
      </T>
      <CreditPill credits={state.credits || 0} className="absolute right-[20px] top-[55px]" />
      <T y={122.5} size={28.5} lh={36} left={20} className="a-up font-bold text-navy">
        {"한 걸음씩,\n나의 전공을 알아가는 중"}
      </T>
      <T y={201.5} size={14.5} left={20.5} className="a-up text-gray" style={delay(0.08)}>
        {graduated ? "졸업했어요! 남은 과목도 계속 들을 수 있어요." : `지금은 ${openYear}학년 과목까지 들을 수 있어요.`}
      </T>
      <T y={263.5} size={d.name.length > 8 ? 15 : 19.5} left={20} clip={190} className="a-up font-bold text-ink-2" style={delay(0.14)}>
        {d.name}
      </T>
      <T y={294.5} size={12.5} lh={16} left={20.5} clip={170} className="a-up text-mint-deep" style={delay(0.18)}>
        {`${graduated ? "졸업" : `${openYear}학년 진행 중`}\n이수 ${passedCount}과목${graduated ? ` · 안 들은 과목 ${todo.length}개` : ` · 남은 과제 ${todo.length}개`}`}
      </T>
      {/* 학년 캐릭터: 학년이 열릴 때마다 바뀐다(노션 디자인 시스템의 학년별 캐릭터). */}
      <div key={openYear} className="a-pop absolute left-[174px] top-[261px] h-[154px] w-[208px]" style={delay(0.2)}>
        <img
          src={yearCharacter(openYear).src}
          alt={yearCharacter(openYear).alt}
          className="loop h-full w-full object-contain"
          style={{ animation: "float 2.6s ease-in-out 0.9s infinite" }}
        />
      </div>
      <T y={400.5} size={12.5} left={20} className="text-gray">
        {graduated ? "졸업 완료" : step.target ? `${step.target}학년 해금까지` : "졸업까지"}
      </T>
      <T y={401.5} size={14} left={graduated ? 76 : step.target ? 108 : 70.5} className="font-bold text-mint-deep">
        {`${pct}%`}
        {!graduated && step.total > 0 && (
          <span className="ml-[6px] text-[11.5px] font-normal text-gray">{`필수 ${step.done}/${step.total}${step.target ? "" : " · 졸업 과제 포함"}`}</span>
        )}
      </T>
      <div
        className="absolute left-[20px] top-[423px] h-[8.5px] w-[362px] overflow-hidden rounded-full bg-track"
        role="progressbar"
        aria-label={step.target ? `${step.target}학년 해금까지 진행도(${openYear}학년 필수과목 중 이수한 비율)` : "졸업까지 진행도(4학년 필수과목과 졸업 과제 중 이수한 비율)"}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-mint" style={{ width: `${pct}%`, transition: "width 0.1s linear" }} />
      </div>
      <button
        onClick={open}
        className="pressable a-up absolute left-[20px] top-[443px] flex h-[56.5px] w-[362px] items-center justify-center rounded-[14px] bg-mint px-[16px] text-[17.5px] font-semibold text-white active:brightness-95"
        style={{ animationDelay: "0.3s" }}
      >
        <span className="loop pointer-events-none absolute inset-0 rounded-[14px]" style={{ animation: "glow 2.4s ease-in-out 1.6s infinite" }} />
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{graduated ? "과목 계속 듣기" : `${openYear}학년 과목 듣기`}</span>
      </button>
      {graduated && (
        <button className="text-button a-up absolute right-[20px] top-[503px]" onClick={() => nav.push("graduation")} style={delay(0.34)}>
          졸업 리포트 보기 →
        </button>
      )}
      <T y={535.5} size={15} left={21} className="a-up font-bold text-ink-2" style={delay(0.36)}>
        {graduated ? "아직 안 들은 과목" : openYear < 4 ? `${openYear + 1}학년이 열리려면` : "졸업하려면"}
      </T>
      {shownTodo.map((course, n) => (
        <CourseCard
          key={course.subject}
          top={565 + n * 84}
          wait={0.42 + n * 0.06}
          d={d}
          course={course}
          onClick={() => nav.push("lesson", { subject: course.subject })}
        />
      ))}
      {todo.length > SHOWN_TODO && (
        <T y={565 + SHOWN_TODO * 84} size={12.5} left={21} className="a-up text-ink-3" style={delay(0.6)}>
          {`외 ${todo.length - SHOWN_TODO}과목은 과목 목록에서 볼 수 있어요.`}
        </T>
      )}
      {shownTodo.length === 0 && (
        <T y={585} size={13} left={21} className="a-up text-ink-3" style={delay(0.42)}>
          {graduated ? "체험할 수 있는 과목을 모두 들었어요. 재수강해서 성적을 올릴 수도 있어요." : "모든 과제를 마쳤어요."}
        </T>
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 12 · 학년별 수업                                                    */
/* ------------------------------------------------------------------ */

const STEPS = ["배우기", "직접 해보기", "기록"];
// 스크롤 영역의 아래 끝을 흐리게 한다(아래 여백 20px 안이라 끝까지 내리면 내용이 가려지지 않는다).
const FADE_END = "linear-gradient(to bottom, #000 calc(100% - 20px), transparent)";

/** 수업 단계 칩. 지나온 단계는 ✓를 붙이고 눌러서 다시 볼 수 있다. */
function StepChips({ step, reached, onGo }) {
  return (
    <ol className="absolute left-[20px] top-[100px] flex gap-[8px]" aria-label="수업 단계">
      {STEPS.map((label, i) => {
        const done = i < reached || (i === reached && i < step);
        const current = i === step;
        return (
          <li key={label}>
            <button
              onClick={() => onGo(i)}
              disabled={current || i > reached}
              aria-current={current ? "step" : undefined}
              className={`pressable flex h-[34px] items-center gap-[4px] rounded-full border px-[13px] text-[13.5px] font-semibold transition-colors ${
                current
                  ? "border-mint bg-mint text-white"
                  : done
                    ? "border-mint bg-mint-soft text-mint-deep"
                    : "border-line bg-white text-mute"
              }`}
            >
              {label}
              {done && !current && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-label="완료">
                  <path d="M1.2 4.6 4 7.3 9.8 1.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** 연한 민트 카드(릿톤 시안의 "배운 내용" 카드). */
function MintCard({ title, children, className = "" }) {
  return (
    <section className={`rounded-[20px] bg-mint-soft px-[18px] py-[16px] ${className}`}>
      <h2 className="text-[15px] font-bold leading-[22px] text-ink-2">{title}</h2>
      <div className="mt-[6px] text-[13.5px] leading-[22px] text-ink-3">{children}</div>
    </section>
  );
}

/** 연습 문제 유형별로 "이 수업에서 해볼 것". */
function quizTask(game) {
  if (game.type === "theory") return "퀴즈 3라운드를 풀어요. 라운드마다 유형이 다르고, 다시 할 때마다 유형과 문제가 바뀌어요.";
  const n = game.items.length;
  if (game.type === "blank") return `문장 ${n}개의 빈칸에 알맞은 말을 골라요.`;
  if (game.type === "ox") return `문장 ${n}개가 맞는지 O, X로 골라요.`;
  if (game.type === "order") return `${n}단계를 올바른 순서로 놓아요.`;
  if (game.type === "match") return `서로 관련된 ${n}쌍의 짝을 맞춰요.`;
  return `${n}개를 알맞은 칸으로 나눠요.`;
}
/** 체험 화면을 불러오는 동안. */
function LabLoading() {
  return (
    <Screen>
      <p className="absolute inset-x-[20px] top-[200px] text-center text-[14px] text-ink-3" role="status">
        실습 화면을 불러오는 중이에요…
      </p>
    </Screen>
  );
}

/** 체험 화면을 불러오지 못하거나(네트워크) 화면에 오류가 나면, 앱 전체가 멈추지 않게 이 자리에서 알린다. */
class LabBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("실습 화면 오류", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Screen footer={<FilledButton onClick={this.props.onQuit}>수업으로 돌아가기</FilledButton>}>
        <div className="absolute inset-x-[20px] top-[160px]" role="alert">
          <h1 className="text-[22px] font-bold leading-[32px] text-navy">실습 화면을 열지 못했어요</h1>
          <p className="mt-[8px] text-[14px] leading-[22px] text-gray">인터넷 연결을 확인하고 다시 들어와 주세요. 쓰던 코드는 이 브라우저에 남아 있어요.</p>
        </div>
      </Screen>
    );
  }
}

export function Lesson({ active, nav, route, state, setState }) {
  // 이 화면은 들어올 때의 과목 하나를 다룬다. 열린 학년의 과목만 들을 수 있다.
  const [v] = useState(() => view(state));
  const subject = route?.params?.subject;
  const year = v && typeof subject === "string" ? yearOf(v.d, subject) : null;
  const ok = !!v?.journey && !!year && v.progress.years[year - 1].open;
  const key = ok ? courseKey(v.d.id, subject) : "";
  const game = ok ? gameOf(v.d, subject) : null;
  const isFinal = game === "final";
  // 학과군 전공 실습이면 그 체험 데이터. 아니면 연습 문제 유형(이론 수업)이거나 null(체험 구현 예정).
  const practice = typeof game === "string" && game.startsWith("group:") ? v.d.practice : null;
  // 진짜 수업 체험(labs). 있으면 직접 해보기는 이 체험이고, 연습 문제가 있으면 배우기 단계에서 성적 없이 풀어 본다.
  const lab = ok ? labFor(v.d, subject) : null;
  const typed = !practice && !lab && isLessonType(game);
  const warmup = lab ? gameFor(subject, v.d.lessonGames) : null;
  const quiz = useLessonGame(typed || warmup ? subject : null);
  const [draft, setDraft] = useState(() => (ok ? (state.drafts[key] ?? "") : ""));
  // 체험이나 기록을 이미 시작한 수업은 기록 단계부터 이어간다.
  const [step, setStep] = useState(() => (ok && (state.plays[key] || state.drafts[key]) ? 2 : 0));
  const [reached, setReached] = useState(step);
  const [notice, setNotice] = useState("");
  const [shake, setShake] = useState(0);
  // 수업을 마치고 받은 결과: { grade, percent, best, opened, graduated }.
  const [result, setResult] = useState(null);
  const timer = useRef(0);
  const scroller = useRef(null);
  const heading = useRef(null);
  const moved = useRef(false);
  useGuard(ok, nav, active);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // 단계를 옮기면 맨 위로 올리고 제목에 초점을 둔다(스크린 리더가 새 단계를 읽게).
  useEffect(() => {
    if (!moved.current) return;
    if (scroller.current) scroller.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [step, result]);
  if (!ok) return null;

  const { d, final } = v;
  const kind = isFinal ? "졸업 과제" : kindOf(d, subject);
  const header = <Header title={`${year}학년 · ${subject}`} onBack={nav.back} />;
  const record = recordOf(state, d.id, subject);

  // 체험이 아직 없는 과목(연습 문제가 없어졌거나 형식이 맞지 않는 경우 포함): 구현 예정이라고 알린다. 성적은 남지 않는다.
  if (!isFinal && !practice && !lab && (!typed || quiz.status === "basic"))
    return (
      <Screen foot={700} footer={<FilledButton onClick={nav.back}>과목 목록으로</FilledButton>}>
        {header}
        <div className="flow no-scrollbar absolute bottom-[174px] left-0 top-[100px] w-full overflow-y-auto px-[20px] pt-[18px]">
          <h1 className="a-up text-[26px] font-bold leading-[36px] text-navy">{subject}</h1>
          <p className="a-up mt-[6px] text-[14px] leading-[22px] text-gray" style={delay(0.06)}>
            {`${year}학년 · ${kind} · ${d.name}`}
          </p>
          <MintCard title="체험 구현 예정" className="a-up mt-[22px]">
            <p style={delay(0.1)}>
              {isRequired(d, subject)
                ? "이 과목의 체험은 아직 만들고 있어요. 필수과목이지만 체험이 생기기 전까지는 다음 학년이 열리는 조건에 들어가지 않아요."
                : "이 과목의 체험은 아직 만들고 있어요. 다른 과목을 먼저 들어 보세요."}
            </p>
          </MintCard>
        </div>
      </Screen>
    );

  // 수업을 마친다: 성적을 매겨 남기고(재수강이면 더 좋은 성적), 다음 학년이 열렸는지·졸업했는지 알려준다.
  const finishWith = (base, text) => {
    window.clearTimeout(timer.current);
    const before = progressOf(base, d);
    const after = completeCourse(base, d.id, subject, text);
    if (after === base) return false;
    const play = base.plays[key];
    const got = gradeOf(play.score);
    const progress = progressOf(after, d);
    setState(after);
    moved.current = true;
    setResult({
      ...got,
      best: recordOf(after, d.id, subject),
      credits: (after.credits || 0) - (base.credits || 0),
      // 새로 열린 학년들(체험이 있는 필수과목이 없는 학년은 함께 열린다).
      opened: progress.openYear > before.openYear ? YEARS.filter((y) => y > before.openYear && y <= progress.openYear) : null,
      graduated: progress.graduated && !before.graduated,
    });
    return true;
  };
  const again = () => {
    moved.current = true;
    setResult(null);
    setDraft("");
    setStep(0);
    setReached(0);
  };

  if (result) {
    const passed = passes(result.grade);
    return (
      <Screen
        foot={700}
        footer={
          result.graduated ? (
            <FilledButton onClick={() => nav.replace("grades", undefined, "fade")}>성적표와 졸업증명서 받기</FilledButton>
          ) : (
            <>
              <div className="absolute inset-x-[20px] top-[708px] flex h-[36px] items-center justify-end">
                <button onClick={again} className="pressable h-[36px] rounded-full border border-line bg-white px-[14px] text-[13px] font-semibold text-slate">
                  다시 듣기
                </button>
              </div>
              <FilledButton onClick={nav.back}>과목 목록으로</FilledButton>
            </>
          )
        }
      >
        {header}
        <div ref={scroller} className="flow no-scrollbar absolute bottom-[174px] left-0 top-[100px] w-full overflow-y-auto px-[20px] pt-[18px]">
          <h1 ref={heading} tabIndex={-1} className="a-up text-[26px] font-bold leading-[36px] text-navy outline-none">
            {`${subject} 성적`}
          </h1>
          <p className="a-pop mt-[18px] text-[56px] font-extrabold leading-[64px] text-mint-deep" style={delay(0.1)} aria-label={`이번 성적 ${result.grade}`}>
            {result.grade}
          </p>
          <p className="a-up mt-[4px] text-[14px] leading-[22px] text-gray" style={delay(0.16)}>
            {result.grade === PASS ? "끝까지 해서 통과(P)했어요." : `정답률 ${result.percent}%`}
            {result.best && result.best.grade !== result.grade ? ` · 남는 성적은 가장 좋은 ${gradeText(result.best)}이에요` : ""}
          </p>
          {result.credits > 0 && <CreditPill credits={result.credits} className="a-pop mt-[12px] inline-flex" style={delay(0.2)} />}
          {result.credits > 0 && <span className="sr-only">{`크레딧 ${josa(String(result.credits), "을", "를")} 받았어요`}</span>}
          <MintCard
            title={result.graduated ? "졸업을 축하해요!" : result.opened ? `${result.opened.join("·")}학년이 열렸어요!` : passes(result.best?.grade) ? "이수했어요" : "재수강이 필요해요"}
            className="a-up mt-[22px]"
          >
            <p style={delay(0.2)}>
              {result.graduated
                ? `${d.name} 체험 과정을 모두 마쳤어요. 성적표와 졸업증명서를 받아요.`
                : result.opened
                  ? `${result.opened[0] - 1}학년 필수과목을 모두 ${PASS_GRADE} 이상으로 이수했어요. 이제 ${result.opened.at(-1)}학년 과목까지 들을 수 있어요.` +
                    (result.opened.length > 1 ? ` ${result.opened.slice(0, -1).join("·")}학년은 체험이 있는 필수과목이 아직 없어 함께 열렸어요.` : "")
                  : passes(result.best?.grade)
                    ? `${isRequired(d, subject) ? "필수과목으로 인정됐어요." : "선택과목으로 성적표에 남아요."} 다시 들으면 문제가 바뀌고, 가장 좋은 성적이 남아요.`
                    : `${PASS_GRADE} 이상이어야 이수로 인정돼요.${isRequired(d, subject) ? " 필수과목이라 다음 학년이 열리려면 다시 들어야 해요." : ""} 다시 들으면 문제가 바뀌어요.`}
            </p>
          </MintCard>
          {result.opened && (
            <div className="a-pop mt-[16px] flex items-center gap-[12px] rounded-[16px] border border-cream-line bg-cream px-[14px] py-[10px]" style={delay(0.3)}>
              <img src={yearCharacter(result.opened.at(-1)).src} alt={yearCharacter(result.opened.at(-1)).alt} className="h-[64px] w-[72px] object-contain" />
              <p className="whitespace-pre-line text-[13px] font-semibold leading-[19px] text-ink-2">{`${result.opened.at(-1)}학년이 되어\n캐릭터도 자랐어요!`}</p>
            </div>
          )}
          {!passed && passes(result.best?.grade) && (
            <p className="a-up mt-[12px] text-[12.5px] leading-[19px] text-ink-3" style={delay(0.24)}>
              이번 성적은 낮지만 이전에 받은 더 좋은 성적이 남아 있어요.
            </p>
          )}
        </div>
      </Screen>
    );
  }

  if (isFinal && final.kind === "artwork")
    return (
      <Screen>
        <Header title={d.name} onBack={nav.back} />
        <Rub
          data={final}
          year={year}
          onQuit={nav.back}
          onDone={() => finishWith(savePlay(state, d.id, subject, "final", `${final.name} 완성`, PASS), "")}
        />
      </Screen>
    );

  // 수업의 종류: 졸업 프로젝트(AI 가르치기 등), 학과군 전공 실습, 진짜 수업 체험, 연습 문제(불러오는 중·오류 포함).
  const mode = isFinal ? "project" : practice ? "practice" : lab ? "lab" : quiz.status === "ready" ? "quiz" : quiz.status;
  const play = state.plays[key]?.game === game ? state.plays[key] : null;
  const played = play?.summary || "";
  const preview = play ? gradeOf(play.score) : null;
  const headline = mode === "project" ? final.name : mode === "practice" ? practice.title : mode === "lab" ? lab.title : mode === "quiz" ? quiz.game.title : subject;
  const warn = (message) => {
    setNotice(message);
    setShake((n) => n + 1);
  };
  const go = (next) => {
    moved.current = true;
    setNotice("");
    setStep(next);
    setReached((r) => Math.max(r, next));
  };
  // 입력할 때마다 전체 상태를 저장하지 않도록 잠시 모았다가 저장한다.
  const edit = (text) => {
    setDraft(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState((s) => ({ ...s, drafts: { ...s.drafts, [key]: text } })), 400);
  };
  const finish = () => {
    if (!play) return warn("먼저 직접 해보기를 끝까지 해보세요.");
    if (!finishWith(state, draft)) warn("성적을 남기지 못했어요. 과목 목록에서 다시 들어와 주세요.");
  };
  const written = !!draft.trim();

  // 진짜 수업 체험은 화면 전체를 그 수업의 공간으로 바꿔서 한다. 나가면 배우기로(이미 제출했으면 기록으로), 제출하면 기록 단계로 간다.
  if (mode === "lab" && step === 1) {
    const LabScreen = LAB_SCREENS[lab.id];
    const leave = () => go(play ? 2 : 0);
    return (
      <LabBoundary onQuit={leave}>
        <Suspense fallback={<LabLoading />}>
          <LabScreen
            lab={lab}
            subject={subject}
            saveKey={key}
            onQuit={leave}
            onDone={(summary, score) => {
              setState((s) => savePlay(s, d.id, subject, game, summary, score));
              go(2);
            }}
          />
        </Suspense>
      </LabBoundary>
    );
  }

  let body;
  let action;
  if (step === 0) {
    const task = mode === "project" ? final.task : mode === "practice" ? practice.task : mode === "lab" ? lab.task : mode === "quiz" ? quizTask(quiz.game) : null;
    const learn = (mode === "practice" ? practice : mode === "project" ? final : mode === "lab" ? lab : null)?.learn;
    body = (
      <>
        {mode === "loading" && (
          <p className="a-up mt-[22px] text-[13.5px] text-ink-3" role="status">
            연습 문제를 불러오는 중이에요…
          </p>
        )}
        {mode === "error" && (
          <div className="a-up mt-[22px]" role="alert">
            <p className="body-copy">{quiz.message}</p>
            <button className="button" onClick={quiz.retry}>
              다시 시도
            </button>
          </div>
        )}
        {learn && (
          <MintCard title="알아두기" className="a-up mt-[22px]">
            <p style={delay(0.1)}>{learn}</p>
          </MintCard>
        )}
        {task && (
          <MintCard title="이 수업에서 해볼 것" className={`a-up ${learn ? "mt-[12px]" : "mt-[22px]"}`}>
            <p style={delay(0.12)}>{task}</p>
          </MintCard>
        )}
        {mode === "lab" && (
          <p className="a-up mt-[12px] text-[12px] leading-[18px] text-gray" style={delay(0.14)}>
            {`근거: ${lab.source}`}
          </p>
        )}
        {(mode === "quiz" || mode === "practice" || mode === "project" || mode === "lab") && (
          <p className="a-up mt-[12px] text-[12.5px] leading-[19px] text-ink-3" style={delay(0.16)}>
            {final.kind === "artwork" && isFinal
              ? "끝까지 하면 통과(P)예요."
              : mode === "lab"
                ? `직접 해보기의 과제 채점 결과로 성적을 매겨요. ${PASS_GRADE} 이상이면 이수예요.`
                : `처음 고른 답으로 성적을 매겨요. ${PASS_GRADE} 이상이면 이수예요.`}
            {record ? ` 지금 성적은 ${gradeText(record)}이고, 다시 들으면 가장 좋은 성적이 남아요.` : ""}
          </p>
        )}
      </>
    );
    if (mode === "lab" && warmup)
      body = (
        <>
          {body}
          <div className="a-up mt-[22px]" style={delay(0.2)}>
            <p className="mb-[8px] text-[12.5px] leading-[19px] text-ink-3">수업에서 배우는 개념을 먼저 풀어 봐요. 이 연습은 성적에 들어가지 않아요.</p>
            {quiz.status === "ready" ? (
              <LessonGame game={quiz.game} played="" onComplete={() => {}} />
            ) : quiz.status === "loading" ? (
              <p className="text-[13.5px] text-ink-3" role="status">
                연습 문제를 불러오는 중이에요…
              </p>
            ) : quiz.status === "error" ? (
              <div role="alert">
                <p className="body-copy">{quiz.message}</p>
                <button className="button" onClick={quiz.retry}>
                  다시 시도
                </button>
              </div>
            ) : null}
          </div>
        </>
      );
    action = (
      <FilledButton onClick={() => go(1)} disabled={mode === "loading" || mode === "error"}>
        직접 해보기
      </FilledButton>
    );
  } else if (step === 1) {
    body = (
      <div className="a-up mt-[22px]">
        <LessonGame
          game={mode === "project" ? final : mode === "practice" ? practice : quiz.game}
          played={played}
          onComplete={(summary, score) => {
            setNotice("");
            setState((s) => savePlay(s, d.id, subject, game, summary, score ?? PASS));
          }}
        />
      </div>
    );
    action = <FilledButton onClick={() => (play ? go(2) : warn("먼저 끝까지 해보세요."))}>기록하러 가기</FilledButton>;
  } else {
    body = (
      <>
        {(mode === "quiz" || mode === "project" || mode === "lab" || (mode === "practice" && practice.learn)) && (
          <MintCard title="배운 내용" className="a-up mt-[22px]">
            <p>{mode === "quiz" ? quiz.game.explanation : mode === "project" ? final.explanation : mode === "lab" ? lab.takeaway : practice.learn}</p>
          </MintCard>
        )}
        {played && (
          <p className="a-up mt-[14px] text-[13px] leading-[20px] text-mint-deep" style={delay(0.06)}>
            {`오늘 해본 것 · ${played}${preview ? ` · 예상 성적 ${preview.grade}` : ""}`}
          </p>
        )}
        <label className="note-card a-up mt-[16px] block" style={delay(0.12)}>
          <strong>{isFinal ? "체험을 마치며 남기는 생각" : "한 줄 기록"}</strong>
          <textarea
            className="compact"
            rows={2}
            placeholder={isFinal ? "이 전공을 체험하며 알게 된 점이나 달라진 생각을 남겨요." : "직접 해보니 어땠나요? 느낀 점을 한 줄로 남겨요."}
            value={draft}
            maxLength={3000}
            onChange={(e) => edit(e.target.value)}
          />
          <small>{draft.length.toLocaleString()} / 3,000자</small>
        </label>
      </>
    );
    action = <FilledButton onClick={finish}>{written ? "기록 저장하고 성적 받기" : "기록 건너뛰고 성적 받기"}</FilledButton>;
  }

  return (
    <Screen
      foot={740}
      footer={
        <>
          {action}
          <p
            key={shake}
            role="status"
            className={`absolute inset-x-[20px] top-[818px] overflow-hidden text-ellipsis whitespace-nowrap text-center text-[12.5px] leading-[20px] ${notice ? "a-shake text-mint-deep" : "text-gray"}`}
          >
            {notice}
          </p>
        </>
      }
    >
      {header}
      <StepChips step={step} reached={reached} onGo={go} />
      <div
        ref={scroller}
        className="flow no-scrollbar absolute left-0 top-[146px] w-full overflow-y-auto px-[20px] pb-[20px] pt-[18px]"
        // 아래 버튼 바로 위까지 쓴다. 내용이 이어지면 끝이 흐려져 스크롤할 수 있다는 것을 알린다.
        style={{ bottom: "calc(130px - var(--bt) * 1px)", maskImage: FADE_END, WebkitMaskImage: FADE_END }}
      >
        <div key={step}>
          <h1 ref={heading} tabIndex={-1} className="a-up text-[26px] font-bold leading-[36px] text-navy outline-none">
            {headline}
          </h1>
          <p className="a-up mt-[6px] text-[14px] leading-[22px] text-gray" style={delay(0.06)}>
            {isFinal
              ? `${year}학년 · 졸업 과제 · ${subject}`
              : practice
                ? `${year}학년 · ${kind} · ${subject} · ${groupName(d.studyGroup)} 전공 실습`
                : `${year}학년 · ${kind} · ${subject}`}
          </p>
          {body}
          {/* 이전 단계(첫 단계에서는 없음). 위의 단계 칩으로도 돌아갈 수 있어서, 화면이 낮아도 체험 영역을 넓게 쓰도록 내용 끝에 둔다. */}
          {step > 0 && (
            <button onClick={() => go(step - 1)} className="pressable mt-[16px] h-[36px] rounded-full border border-line bg-white px-[14px] text-[13px] font-semibold text-slate">
              ← 이전 단계
            </button>
          )}
        </div>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 12-1 · 학년별 과목 (열린 학년의 과목을 아무 순서로나 듣는다)          */
/* ------------------------------------------------------------------ */

export function Courses({ active, nav, route, state }) {
  const v = view(state);
  const ok = !!v?.journey;
  const [year, setYear] = useState(() => (YEARS.includes(route?.params?.year) ? route.params.year : 1));
  useGuard(ok, nav, active);
  if (!ok) return null;
  const { d, progress } = v;
  const info = progress.years[year - 1];
  // 필수를 먼저, 그 안에서 체험이 있는 과목을 먼저 둔다. 같으면 편성표 순서다.
  const items = [...info.courses].sort((a, b) => b.required - a.required || a.planned - b.planned);
  const required = info.courses.filter((course) => course.required);
  const counted = required.filter((course) => !course.planned);
  const before = progress.years[year - 2];
  const guide = !info.open
    ? `${year - 1}학년 필수과목을 모두 ${PASS_GRADE} 이상으로 이수하면 열려요.${before?.open ? ` 남은 과목: ${before.left.map((course) => course.subject).join(", ")}` : ""}`
    : year < 4
      ? info.left.length
        ? `필수 ${counted.length}과목(체험이 있는 것) 중 ${info.left.length}과목이 남았어요. 모두 ${PASS_GRADE} 이상이면 ${year + 1}학년이 열려요.`
        : `${year}학년 필수과목을 모두 이수했어요. ${year + 1}학년이 열렸어요.`
      : progress.graduated
        ? "졸업 조건을 모두 채웠어요."
        : `4학년 필수과목을 ${PASS_GRADE} 이상으로 이수하고 졸업 과제(${d.finalSubject})를 마치면 졸업해요.`;
  const badge = (course) =>
    course.added && !course.record ? (
      <span className="flex h-[22px] shrink-0 items-center rounded-full border border-mint bg-mint px-[8px] text-[11px] font-bold text-white">새 체험</span>
    ) : course.record ? (
      <span
        className={`flex h-[22px] shrink-0 items-center rounded-full border px-[8px] text-[11px] font-bold ${
          course.passed ? "border-mint bg-mint-soft text-mint-deep" : "border-[#e8a33d] bg-cream text-[#9a5b00]"
        }`}
      >
        {course.passed ? course.record.grade : `${course.record.grade} · 재수강`}
      </span>
    ) : course.planned ? (
      <span className="flex h-[22px] shrink-0 items-center rounded-full border border-line bg-white px-[8px] text-[11px] font-semibold text-gray">구현 예정</span>
    ) : null;
  return (
    <Screen>
      <Header title={`${d.name} · 과목 듣기`} onBack={nav.back} />
      <div className="flow no-scrollbar absolute bottom-0 left-0 top-[100px] w-full overflow-y-auto px-[20px] pb-[32px] pt-[12px]">
        <div className="a-up grid grid-cols-4 gap-[6px]" role="tablist" aria-label="학년">
          {YEARS.map((item) => {
            const opened = progress.years[item - 1].open;
            return (
              <button
                key={item}
                role="tab"
                aria-selected={item === year}
                onClick={() => setYear(item)}
                className={`pressable h-[40px] rounded-full border text-[13.5px] font-semibold ${
                  item === year ? "border-mint bg-mint text-white" : opened ? "border-mint bg-white text-mint-deep" : "border-line bg-chalk text-mute"
                }`}
              >
                {`${item}학년${opened ? "" : " 🔒"}`}
              </button>
            );
          })}
        </div>
        <h1 className="a-up mt-[18px] text-[22px] font-bold leading-[32px] text-navy">{`${year}학년 과목 ${info.courses.length}개`}</h1>
        <p className="a-up mt-[6px] text-[13.5px] leading-[21px] text-gray" style={delay(0.06)}>
          {guide}
        </p>
        <ul className="mt-[18px] grid gap-[10px]">
          {items.map((course, i) => (
            <li key={course.subject} className="a-up" style={delay(0.1 + Math.min(i, 8) * 0.03)}>
              <button
                onClick={() => nav.push("lesson", { subject: course.subject })}
                disabled={!info.open}
                className={`pressable flex min-h-[62px] w-full items-center gap-[10px] rounded-[14px] border px-[16px] py-[10px] text-left disabled:opacity-60 ${
                  course.planned ? "border-line bg-white active:bg-chalk" : "border-cream-line bg-cream active:bg-cream-2"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-[6px]">
                    <span className="truncate text-[15px] font-semibold leading-[22px] text-ink-2">{course.subject}</span>
                    {course.required && <span className="shrink-0 text-[11px] font-bold text-mint">필수</span>}
                  </span>
                  <span className="block text-[12px] leading-[18px] text-gray">
                    {course.final
                      ? `졸업 과제 · ${d.final.name}`
                      : `${course.kind} · ${course.planned ? "체험을 만들고 있어요" : `${experienceName(d, gameOf(d, course.subject))}로 체험해요`}`}
                    {course.record && course.record.attempts > 1 ? ` · ${course.record.attempts}번 들음` : ""}
                    {course.added ? " · 새 체험이 추가됐어요. 다음 학년은 그대로 열려 있고, 다시 해볼 수 있어요" : ""}
                  </span>
                </span>
                {badge(course)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 15 · 졸업                                                           */
/* ------------------------------------------------------------------ */

// 학과에서 가장 최근에 남긴 기록(학년이 높은 과목부터).
function lastNote(state, d) {
  for (const year of [...YEARS].reverse())
    for (const subject of [...d.years[year]].reverse()) {
      const note = state.notes[courseKey(d.id, subject)];
      if (note) return note;
    }
  return "";
}

export function Graduation({ active, nav, state }) {
  const v = view(state);
  const ok = !!v?.progress.graduated;
  const taken = ok ? v.progress.taken : [];
  const average = averagePoint(taken.map((course) => course.record.grade));
  const done = useCountUp(ok ? v.progress.passedCount : 0, 900, 800);
  useGuard(ok, nav, active);
  if (!ok) return null;
  const { d } = v;
  const title = `${d.school} ${d.name}`;
  return (
    <Screen
      h={754}
      foot={754}
      veil="#feeaa0"
      footer={
        <>
          <OutlineButton onClick={() => nav.reset(["home", "major"], "fade")} className="a-up" style={delay(0.95)}>
            남은 과목 계속 듣기
          </OutlineButton>
          <button
            onClick={() => nav.reset([["home", { focus: "departments" }]], "fade")}
            className="pressable a-fade absolute left-[100px] top-[830px] h-[32px] w-[202px] text-[13px] text-mint-deep underline"
            style={delay(1.05)}
          >
            다른 학과도 체험하러 가기
          </button>
        </>
      }
    >
      <Header title="졸업을 축하합니다" onBack={() => nav.reset(["home"], "fade")} />
      <div className="a-pop absolute left-[100px] top-[128px] h-[158px] w-[190px]" style={delay(0.05)}>
        <img
          src={img.mascotGrad}
          alt=""
          className="loop h-full w-full"
          style={{ animation: "hop 2.2s ease-in-out 1s infinite", transformOrigin: "50% 100%" }}
        />
      </div>
      <Confetti originX={195} originY={215} />
      <T y={311.5} size={title.length > 13 ? 19 : 27.5} lh={40} center clip={386} className="a-up font-bold text-mint" style={delay(0.35)}>
        {`${title}\n졸업을 축하해요!`}
      </T>
      <div className="a-fade absolute left-0 top-[428px] h-[79px] w-full border-y-2 border-mint-line bg-mint-soft" style={delay(0.5)}>
        {[
          { v: "4학년", l: "체험 단계", cx: 71.5, y: 21, size: 20, ly: 46.5 },
          { v: `${done}과목`, l: "이수 과목", cx: 198, y: 21, size: 20, ly: 46.5 },
          { v: average === null ? "P" : average.toFixed(2), l: average === null ? "통과" : "평균 평점 / 4.5", cx: 327.5, y: 21, size: 20, ly: 46.5 },
        ].map((st) => (
          <div key={st.l} className="absolute top-0 w-[120px] text-center" style={{ left: st.cx - 60 }}>
            <T y={st.y} size={st.size} center className="font-bold text-mint-deep">
              {st.v}
            </T>
            <T y={st.ly} size={11.5} center className="text-gray">
              {st.l}
            </T>
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 left-0 top-[507px] w-full bg-butter">
        <div className="a-up pointer-events-none absolute inset-0" style={delay(0.65)}>
          <T y={53.5} size={21} left={21} clip={360} className="font-bold text-ink-2">
            {`나의 ${d.name} 체험 리포트`}
          </T>
        </div>
        <div className="a-up pointer-events-none absolute inset-0" style={delay(0.75)}>
          <T y={105} size={13} left={20.5} className="font-bold text-mint-deep">
            들은 과목
          </T>
          <div className="report-text absolute left-[20.5px] top-[124px] w-[360px] text-[12px] leading-[18px] text-ink-2" style={{ WebkitLineClamp: 2 }}>
            {taken.map((course) => `${course.subject} ${course.record.grade}`).join(" · ")}
          </div>
        </div>
        <div className="a-up pointer-events-none absolute inset-0" style={delay(0.85)}>
          <T y={173} size={13} left={20.5} className="font-bold text-mint-deep">
            느낀 점
          </T>
          <div className="report-text absolute left-[20.5px] top-[192px] w-[360px] text-[12px] leading-[18px] text-ink-2" style={{ WebkitLineClamp: 3 }}>
            {lastNote(state, d) || "남긴 기록이 없어요."}
          </div>
        </div>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 마이페이지                                                          */
/* ------------------------------------------------------------------ */

function reportText(state, d) {
  const progress = progressOf(state, d);
  const average = averagePoint(progress.taken.map((course) => course.record.grade));
  const lines = progress.years.map(({ year, courses }) => {
    const taken = courses.filter((course) => course.record);
    const body = taken.length
      ? taken
          .map(
            (course) =>
              `- ${course.subject} (${course.final ? "졸업 과제" : course.kind}) ${gradeText(course.record)}${course.passed ? "" : " [재수강 필요]"}\n  ${state.notes[courseKey(d.id, course.subject)] || "기록 없음"}`,
          )
          .join("\n")
      : "- 들은 과목 없음";
    return `${year}학년\n${body}`;
  });
  const status = `${progress.graduated ? "졸업" : `${progress.openYear}학년 진행 중`} · 이수 ${progress.passedCount}과목${average === null ? "" : ` · 평균 평점 ${average.toFixed(2)} / 4.5`}`;
  return `${d.school} ${d.name} 체험 리포트\n\n${status}\n\n${lines.join("\n\n")}`;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function My({ nav, state, setState }) {
  const [confirming, setConfirming] = useState(false);
  const journeys = Object.entries(state.journeys)
    .map(([id]) => ({ d: all(state).find((item) => item.id === id && item.school) }))
    .filter((item) => item.d);
  const choose = (d, to) => {
    setState((s) => ({ ...s, current: d.id }));
    if (to === "major") nav.reset(["home", "major"]);
    else nav.push(to);
  };
  return (
    <Screen foot={TAB_TOP} veil={false} footer={<TabBar active="my" nav={nav} state={state} />}>
      <Header title="마이페이지" onBack={nav.back} />
      <div
        className="flow no-scrollbar absolute left-0 top-[104px] w-full overflow-y-auto px-[20px] pb-[24px] pt-[20px]"
        style={{ bottom: `calc(${TAB_H}px - var(--bt) * 1px)` }}
      >
        <div className="flex items-center justify-between">
          <h1 className="a-up text-[20px] font-semibold leading-[28px] text-mint">나의 체험 기록</h1>
          <CreditPill credits={state.credits || 0} className="a-up" />
        </div>
        <p className="a-up mt-[4px] text-[14px] leading-[22px] text-gray" style={delay(0.06)}>
          {`과목을 이수할 때마다 크레딧 ${josa(String(CREDIT_PER_PASS), "을", "를")} 받아요. 모은 크레딧은 멘토링이 생기면 쓸 수 있어요. 기록은 이 브라우저에만 저장돼요.`}
        </p>
        {journeys.length === 0 && <p className="a-fade mt-[40px] text-center text-[14px] text-mute">아직 체험한 학과가 없어요.</p>}
        {journeys.map(({ d }, i) => {
          const progress = progressOf(state, d);
          const finished = progress.graduated;
          const average = averagePoint(progress.taken.map((course) => course.record.grade));
          return (
            <div key={d.id} className="a-up mt-[14px] rounded-[16px] border border-cream-line bg-cream p-[16px]" style={delay(0.12 + Math.min(i, 6) * 0.06)}>
              <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-semibold text-slate">
                {d.school} {d.name}
              </strong>
              <p className="mt-[4px] text-[12px] leading-[18px] text-gray">
                {`${finished ? "졸업" : `${progress.openYear}학년 진행 중`} · 이수 ${progress.passedCount}과목${average === null ? "" : ` · 평점 ${average.toFixed(2)}`}`}
              </p>
              <div className="mt-[12px] flex flex-wrap gap-[8px]">
                <button className="button" onClick={() => choose(d, "major")}>
                  이어서 체험하기
                </button>
                {finished && (
                  <button className="button ghost" onClick={() => choose(d, "graduation")}>
                    졸업 리포트 보기
                  </button>
                )}
                {progress.taken.length > 0 && (
                  <button className="button ghost" onClick={() => download(`${d.school}-${d.name}-체험-리포트.txt`, reportText(state, d))}>
                    리포트 내려받기
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div className="mt-[28px] text-center">
          {confirming ? (
            <div role="alert">
              <p className="text-[13px] leading-[20px] text-ink-3">
                추천 질문의 답, 체험 기록, 리포트가 모두 지워져요.
                <br />
                필요한 리포트는 먼저 내려받아 주세요.
              </p>
              <div className="mt-[10px] flex justify-center gap-[8px]">
                <button className="button ghost" onClick={() => setConfirming(false)}>
                  그대로 두기
                </button>
                <button
                  className="button danger"
                  onClick={() => {
                    // 학과 데이터는 남겨 두어 처음부터 다시 시작해도 바로 학과를 볼 수 있게 한다.
                    setState((s) => ({ ...structuredClone(initialState), catalog: s.catalog }));
                    nav.reset(["splash"]);
                  }}
                >
                  모두 지우기
                </button>
              </div>
            </div>
          ) : (
            <>
              <button className="button ghost mb-[14px]" onClick={() => nav.push("school", { change: true })}>
                {`학교 바꾸기 · 지금 ${CAMPUS.school} ${CAMPUS.name}`}
              </button>
              <br />
              <button className="text-button" onClick={() => setConfirming(true)}>
              처음부터 다시 시작하기
              </button>
            </>
          )}
        </div>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 15 · 커뮤니티(미리보기): 질문, 재학생 커피챗                          */
/* ------------------------------------------------------------------ */

const COMMUNITY_TABS = [
  { id: "questions", label: "질문" },
  { id: "mentors", label: "재학생 커피챗" },
];

/** 학과 이름표(민트 글씨 알약). */
function DeptPill({ name }) {
  return <span className="inline-flex h-[22px] max-w-full items-center truncate rounded-full bg-mint-soft px-[9px] text-[11.5px] font-bold text-mint-deep">{name}</span>;
}

/** 위쪽에 붙는 화면 이름과 미리보기 안내. */
function CommunityHead() {
  return (
    <>
      <T y={60} size={24} lh={32} left={20} className="font-bold text-navy">
        커뮤니티
      </T>
      <p className="absolute left-[132px] right-[20px] top-[58px] truncate rounded-full border border-cream-line bg-cream px-[10px] text-center text-[11px] font-semibold leading-[24px] text-ink-3" role="note">
        미리보기 버전이에요 · 글과 프로필은 예시예요
      </p>
    </>
  );
}

/** 덮는 화면(질문 상세·쓰기)의 위쪽 줄. */
function SheetTop({ label, title, onClose, close = "back" }) {
  return (
    <div className="relative flex shrink-0 items-center px-[17px] pb-[8px]" style={{ paddingTop: "calc((48 - var(--tt)) * 1px)" }}>
      <button type="button" aria-label={label} onClick={onClose} className="pressable flex h-[40px] w-[40px] items-center justify-center text-[24px] leading-none text-gray">
        {close === "back" ? <Mask src={icon.back} w={16} h={24} color="#949494" /> : "×"}
      </button>
      <span className="flex-1 pr-[40px] text-center text-[14px] text-mint">{title}</span>
    </div>
  );
}

const INPUT = "rounded-[12px] border border-line bg-chalk px-[14px] text-[16px] text-ink-2 outline-none placeholder:text-mute focus:border-mint focus:bg-white";

/** 질문 상세: 본문, 댓글 목록, 댓글 입력. 화면 전체를 덮는다. */
function QuestionDetail({ question, deptName, onBack, onComment }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const heading = useRef(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const send = (e) => {
    e.preventDefault();
    const problem = checkComment(draft);
    setError(problem || "");
    if (problem) return;
    onComment(draft);
    setDraft("");
  };
  return (
    <div className="a-fade absolute inset-0 z-30 flex flex-col bg-white" onKeyDown={(e) => e.key === "Escape" && onBack()}>
      <SheetTop label="질문 목록으로" title="질문" onClose={onBack} />
      <div className="flow no-scrollbar min-h-0 flex-1 overflow-y-auto px-[20px] pb-[20px]">
        <DeptPill name={deptName} />
        <h1 ref={heading} tabIndex={-1} className="mt-[10px] text-[21px] font-bold leading-[30px] text-navy outline-none">
          {question.title}
        </h1>
        <p className="mt-[4px] text-[12px] text-gray">{`${question.author} · ${timeAgo(question.at)}`}</p>
        <p className="mt-[14px] whitespace-pre-wrap text-[14.5px] leading-[24px] text-ink-2">{question.body}</p>
        <h2 className="mt-[24px] border-t border-line pt-[16px] text-[14px] font-bold text-ink-2">{`댓글 ${question.comments.length}`}</h2>
        {question.comments.length === 0 && <p className="mt-[10px] text-[13px] text-gray">아직 댓글이 없어요. 첫 댓글을 남겨 보세요.</p>}
        <ul className="mt-[6px]">
          {question.comments.map((c) => (
            <li key={c.id} className="border-b border-line py-[12px] last:border-b-0">
              <p className="text-[12px] font-semibold text-ink-3">{`${c.author} · ${timeAgo(c.at)}`}</p>
              <p className="mt-[4px] whitespace-pre-wrap text-[14px] leading-[22px] text-ink-2">{c.body}</p>
            </li>
          ))}
        </ul>
      </div>
      <form onSubmit={send} className="shrink-0 border-t border-line bg-white px-[16px] pt-[10px]" style={{ paddingBottom: "calc((36 - var(--bt)) * 1px)" }}>
        <div className="flex items-center gap-[8px]">
          <label htmlFor="comment-input" className="sr-only">
            댓글
          </label>
          <input
            id="comment-input"
            value={draft}
            maxLength={COMMENT_MAX}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError("");
            }}
            placeholder="댓글을 남겨 보세요"
            autoComplete="off"
            enterKeyHint="send"
            className={`h-[44px] min-w-0 flex-1 ${INPUT}`}
          />
          <button type="submit" disabled={!draft.trim()} className="button h-[44px] shrink-0">
            등록
          </button>
        </div>
        <p role="alert" className="min-h-[18px] pt-[2px] text-[12px] text-[#c4373b]">
          {error}
        </p>
      </form>
    </div>
  );
}

/** 질문 쓰기: 학과 고르기, 제목, 내용. 화면 전체를 덮는다. */
function QuestionWrite({ departments, initialDept, onCancel, onSubmit }) {
  const [form, setForm] = useState({ dept: initialDept || "", title: "", body: "" });
  const [error, setError] = useState("");
  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (error) setError("");
  };
  const submit = (e) => {
    e.preventDefault();
    const problem = checkPost(form, departments);
    setError(problem || "");
    if (!problem) onSubmit(form);
  };
  return (
    <form onSubmit={submit} className="a-up absolute inset-0 z-30 flex flex-col bg-white" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <SheetTop label="쓰기 그만두기" title="질문 쓰기" onClose={onCancel} close="x" />
      <div className="flow no-scrollbar min-h-0 flex-1 overflow-y-auto px-[20px] pb-[16px]">
        <fieldset>
          <legend className="text-[14px] font-bold text-ink-2">어느 학과 질문인가요?</legend>
          <div className="mt-[8px] flex flex-wrap gap-[8px]">
            {departments.map((d) => (
              <label
                key={d.id}
                className={`pressable relative flex h-[38px] cursor-pointer items-center rounded-full border px-[14px] text-[13.5px] font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-mint ${
                  form.dept === d.id ? "border-mint bg-mint-soft text-mint-deep" : "border-line bg-white text-ink-3"
                }`}
              >
                <input type="radio" name="dept" value={d.id} checked={form.dept === d.id} onChange={set("dept")} className="sr-only" />
                {d.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label htmlFor="post-title" className="mt-[20px] block text-[14px] font-bold text-ink-2">
          제목
        </label>
        <input id="post-title" value={form.title} maxLength={TITLE_MAX} onChange={set("title")} placeholder="예: 이 학과 실제로 어때요?" autoComplete="off" className={`mt-[8px] h-[46px] w-full ${INPUT}`} />
        <p className="mt-[4px] text-right text-[11.5px] text-gray tabular-nums">{`${form.title.length} / ${TITLE_MAX}`}</p>
        <label htmlFor="post-body" className="mt-[8px] block text-[14px] font-bold text-ink-2">
          내용
        </label>
        <textarea
          id="post-body"
          value={form.body}
          maxLength={BODY_MAX}
          onChange={set("body")}
          rows={7}
          placeholder="궁금한 점을 자세히 적어 주세요."
          className={`mt-[8px] w-full resize-none py-[12px] leading-[24px] ${INPUT}`}
        />
        <p className="mt-[4px] text-right text-[11.5px] text-gray tabular-nums">{`${form.body.length.toLocaleString()} / ${BODY_MAX.toLocaleString()}`}</p>
      </div>
      <div className="shrink-0 px-[20px] pt-[6px]" style={{ paddingBottom: "calc((36 - var(--bt)) * 1px)" }}>
        <p role="alert" className="min-h-[20px] pb-[4px] text-center text-[12.5px] text-[#c4373b]">
          {error}
        </p>
        <button type="submit" className="pressable flex h-[52px] w-full items-center justify-center rounded-[14px] bg-mint text-[17px] font-semibold text-white active:brightness-95">
          올리기
        </button>
      </div>
    </form>
  );
}

/** 커뮤니티 탭(미리보기). 데이터는 communityMock.js의 예시이고, 새 글·댓글은 메모리에만 남는다. */
export function Community({ nav, route, state, active }) {
  const departments = all(state);
  const deptName = (id) => departments.find((d) => d.id === id)?.name || "학과";
  const fullName = (id) => {
    const d = departments.find((x) => x.id === id);
    return d ? `${d.school} ${d.name}` : "학과";
  };
  const startDept = typeof route?.params?.dept === "string" ? route.params.dept : null;
  const [tab, setTab] = useState(() => (COMMUNITY_TABS.some((t) => t.id === route?.params?.tab) ? route.params.tab : "questions"));
  const [filter, setFilter] = useState(startDept || ALL);
  // 고른 필터 칩이 가로 목록 밖에 있으면 보이게 민다(학과 상세에서 그 학과 칩을 골라 들어올 때 등).
  const chipRow = useRef(null);
  useEffect(() => {
    chipRow.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [filter, tab]);
  const [openId, setOpenId] = useState(null);
  const [writing, setWriting] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const questions = useSyncExternalStore(communityStore.subscribe, communityStore.get);
  const shown = filterQuestions(questions, filter, departments, state.journeys);
  const opened = questions.find((q) => q.id === openId) || null;
  const say = (text) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  };
  const chips = [
    { id: ALL, label: "전체" },
    { id: MINE, label: "내가 체험한 학과" },
    ...GROUPS.filter((g) => departments.some((d) => d.studyGroup === g.id)).map((g) => ({ id: g.id, label: g.name })),
    ...(startDept && departments.some((d) => d.id === startDept) ? [{ id: startDept, label: deptName(startDept) }] : []),
  ];
  const emptyText =
    filter === MINE && !Object.keys(state.journeys).length
      ? "아직 체험 중인 학과가 없어요. 홈 지도에서 학과에 입학해 보세요."
      : "이 학과의 질문이 아직 없어요. 첫 질문을 남겨 보세요.";
  // 새 글을 올리면 그 글이 보이게, 지금 필터가 그 글을 가리면 전체로 돌린다.
  const keepsVisible = (dept) => filterQuestions([{ dept }], filter, departments, state.journeys).length > 0;
  const overlay = (
    <>
      {opened && (
        <QuestionDetail
          question={opened}
          deptName={fullName(opened.dept)}
          onBack={() => setOpenId(null)}
          onComment={(body) => communityStore.set(addComment(communityStore.get(), opened.id, body))}
        />
      )}
      {writing && (
        <QuestionWrite
          departments={departments}
          initialDept={departments.some((d) => d.id === filter) ? filter : ""}
          onCancel={() => setWriting(false)}
          onSubmit={(form) => {
            communityStore.set(addQuestion(communityStore.get(), form));
            setWriting(false);
            if (!keepsVisible(form.dept)) setFilter(ALL);
            say("질문을 올렸어요.");
          }}
        />
      )}
      <Toast>{toast}</Toast>
    </>
  );
  return (
    <Screen
      foot={TAB_TOP}
      veil={false}
      overlay={overlay}
      footer={
        <>
          <TabBar active="community" nav={nav} state={state} />
          {tab === "questions" && active && (
            <button
              onClick={() => setWriting(true)}
              disabled={!departments.length}
              style={{ top: TAB_TOP - 15 - 52 }}
              className="pressable absolute right-[20px] z-10 flex h-[52px] items-center gap-[6px] rounded-full bg-mint px-[20px] text-[15.5px] font-bold text-white shadow-[0_8px_20px_rgba(39,216,205,0.35)] active:brightness-95 disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M10.6 2.4 13.6 5.4 5.4 13.6H2.4V10.6L10.6 2.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
              글쓰기
            </button>
          )}
        </>
      }
    >
      <CommunityHead />
      <div role="tablist" aria-label="커뮤니티 메뉴" className="absolute left-[20px] top-[100px] flex h-[42px] w-[362px] rounded-full bg-track p-[4px]">
        {COMMUNITY_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`pressable flex-1 rounded-full text-[13.5px] font-semibold ${tab === t.id ? "bg-white text-mint-deep shadow-[0_2px_6px_rgba(0,0,0,0.08)]" : "text-ink-3"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flow no-scrollbar absolute left-0 right-0 top-[152px] overflow-y-auto" style={{ bottom: `calc((${TAB_H} - var(--bt)) * 1px)` }} role="tabpanel">
        {tab === "questions" && (
          <>
            <div ref={chipRow} className="no-scrollbar flex gap-[8px] overflow-x-auto scroll-px-[20px] px-[20px] pb-[12px]" role="group" aria-label="학과 필터">
              {chips.map((c) => (
                <button
                  key={c.id}
                  aria-pressed={filter === c.id}
                  onClick={() => setFilter(c.id)}
                  className={`pressable h-[34px] shrink-0 whitespace-nowrap rounded-full border px-[13px] text-[13px] font-semibold ${filter === c.id ? "border-mint bg-mint text-white" : "border-line bg-white text-ink-3"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {shown.length === 0 ? (
              <p className="mx-[20px] mt-[8px] rounded-[16px] border border-line bg-chalk px-[16px] py-[18px] text-center text-[13.5px] leading-[21px] text-ink-3" role="status">
                {emptyText}
              </p>
            ) : (
              <ul className="grid gap-[10px] px-[20px] pb-[84px]">
                {shown.map((q) => (
                  <li key={q.id}>
                    <button onClick={() => setOpenId(q.id)} className="pressable block w-full rounded-[16px] border border-cream-line bg-cream px-[15px] py-[13px] text-left active:bg-cream-2">
                      <DeptPill name={deptName(q.dept)} />
                      <span className="mt-[7px] block truncate text-[15.5px] font-bold leading-[22px] text-slate">{q.title}</span>
                      <span className="report-text mt-[3px] text-[12.5px] leading-[19px] text-gray" style={{ WebkitLineClamp: 2 }}>
                        {q.body}
                      </span>
                      <span className="mt-[8px] flex items-center gap-[6px] text-[11.5px] text-ink-3">
                        <svg width="13" height="12" viewBox="0 0 13 12" fill="none" aria-hidden>
                          <path d="M2.2 1h8.6A1.2 1.2 0 0 1 12 2.2v5.6A1.2 1.2 0 0 1 10.8 9H5.5L2.6 11V9h-.4A1.2 1.2 0 0 1 1 7.8V2.2A1.2 1.2 0 0 1 2.2 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                        </svg>
                        <span>{`댓글 ${q.comments.length}`}</span>
                        <span aria-hidden>·</span>
                        <span>{timeAgo(q.at)}</span>
                        <span aria-hidden>·</span>
                        <span className="truncate">{q.author}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {tab === "mentors" && (
          <ul className="grid gap-[12px] px-[20px] pb-[24px]">
            {MOCK_MENTORS.map((m) => (
              <li key={m.id} className="flex gap-[12px] rounded-[18px] border border-line bg-white px-[14px] py-[14px] shadow-[0_4px_14px_rgba(0,0,0,0.04)]">
                <img src={yearCharacter(m.year).src} alt="" className="h-[56px] w-[56px] shrink-0 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-[6px]">
                    <span className="truncate text-[15px] font-bold text-ink-2">{m.nickname}</span>
                    <span className="inline-flex shrink-0 items-center gap-[3px] rounded-full bg-mint-soft px-[7px] text-[10.5px] font-bold leading-[20px] text-mint-deep">
                      <svg width="9" height="8" viewBox="0 0 11 9" fill="none" aria-hidden>
                        <path d="M1.2 4.6 4 7.3 9.8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      인증된 재학생
                    </span>
                  </p>
                  <p className="mt-[2px] truncate text-[12px] text-gray">{`${fullName(m.dept)} · ${m.year}학년`}</p>
                  <p className="mt-[6px] text-[13px] leading-[20px] text-ink-2">{m.intro}</p>
                  <button className="button ghost mt-[10px] min-h-[36px] text-[13px]" onClick={() => say("준비 중인 기능이에요.")}>
                    커피챗 신청
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
  );
}

export const SCREENS = {
  splash: Splash,
  school: School,
  departments: Departments,
  detail: Detail,
  enrolled: Enrolled,
  welcome: Welcome,
  home: Home,
  major: Major,
  lesson: Lesson,
  courses: Courses,
  grades: Grades,
  diploma: Diploma,
  graduation: Graduation,
  my: My,
  community: Community,
};
