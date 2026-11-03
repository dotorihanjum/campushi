import React, { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { icon, img } from "./assets.js";
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
  ProgressBar,
  Screen,
  T,
  Dialog,
  SchoolLogo,
} from "./ui.jsx";
import {
  QUESTIONS,
  answeredAll,
  departmentsOf,
  finalOf,
  recommend,
  completeLesson,
  initialState,
  chooseSubject,
  gameOf,
  plannedAt,
  stageLabel,
  shortStage,
  skipLesson,
  progressOf,
  yearSubjects,
  PARTNER_LABEL,
  PARTNER_EXAMPLE_NOTE,
  showsExampleNote,
} from "./model.js";
import { isLessonType, lessonTypes } from "./lessonGames.js";
import LessonGame, { useLessonGame } from "./Games.jsx";
import { Rub } from "./Templates.jsx";
import { templates } from "./experiences.js";
import { groupName } from "./groups.js";

/* ------------------------------------------------------------------ */
/* 공통                                                                */
/* ------------------------------------------------------------------ */

// 학과 목록(고른 과목 반영).
const all = (state) => departmentsOf(state);

/**
 * 지금 보고 있는 학과와 그 진행 상태. 학교가 정해진 학과가 없으면 null.
 * at에 휴강한(미이수) 자리 번호를 주면 그 자리를 다시 듣는 것으로 본다(retake).
 */
function view(state, at) {
  const d = all(state).find((item) => item.id === state.current && item.school);
  if (!d) return null;
  const journey = state.journeys[d.id] || null;
  const total = d.lessons.length;
  const { completed, skipped, passed, finished } = progressOf(journey, total);
  const retake = Number.isInteger(at) && skipped.includes(at);
  const index = retake ? at : Math.min(completed, total - 1);
  return {
    d,
    journey,
    total,
    completed,
    skipped,
    passed,
    retake,
    index,
    year: d.yearNumbers[index],
    lastYear: d.yearNumbers[total - 1],
    final: finalOf(d),
    finished,
  };
}

const SHOWN_SUBJECTS = 4;
/**
 * 학과 상세의 학년별 과목 칩. 누를 수 없는 글 목록이다. 체험으로 고를 수 있는 과목(open)을 민트 칩으로 먼저 두고,
 * 그 밖의 편성 과목은 흰 칩으로 둔다. 그 밖의 과목이 4개를 넘으면 더 보기로 펼친다.
 */
function YearSubjects({ years }) {
  const [opened, setOpened] = useState({});
  const chip = "max-w-full rounded-[16px] border px-[12px] py-[6px] text-[13px] leading-[19px]";
  return (
    <div className="grid gap-[16px]">
      {years.map(({ year, open, others: names }) => {
        const more = names.length > SHOWN_SUBJECTS && !opened[year];
        const shown = more ? names.slice(0, SHOWN_SUBJECTS) : names;
        return (
          <section key={year} aria-label={`${year}학년 과목`}>
            <span className="inline-flex h-[28px] w-[47px] items-center justify-center rounded-full border border-mint text-[13px] font-semibold text-mint">
              {year}학년
            </span>
            {/* 과목 칩: 글자 길이만큼의 폭으로 이어 놓고 줄 끝에서 다음 줄로 넘긴다. 아주 긴 이름은 칩 안에서 줄바꿈한다. */}
            <ul className="mt-[8px] flex flex-wrap gap-[8px]">
              {open.map((name) => (
                <li key={`open-${name}`} className={`${chip} border-mint bg-mint-soft font-semibold text-mint-deep`} style={{ wordBreak: "keep-all", overflowWrap: "anywhere" }}>
                  <span className="sr-only">체험 과목 </span>
                  {name}
                </li>
              ))}
              {shown.map((name) => (
                <li key={name} className={`${chip} border-line bg-white text-ink-2`} style={{ wordBreak: "keep-all", overflowWrap: "anywhere" }}>
                  <span className="sr-only">구현 예정 </span>
                  {name}
                </li>
              ))}
            </ul>
            {more && (
              <button className="text-button mt-[6px]" onClick={() => setOpened((o) => ({ ...o, [year]: true }))}>
                {`더 보기 (${names.length - SHOWN_SUBJECTS}개)`}
              </button>
            )}
          </section>
        );
      })}
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

const hasBatchim = (word) => {
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

export function Splash({ nav, setState }) {
  const start = () => {
    setState((s) => ({ ...s, onboarded: true }));
    nav.reset(["home"]);
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
/* 02 · 관심 분야가 있는지                                             */
/* ------------------------------------------------------------------ */

function OptionButton({ label, selected, top, onClick, index }) {
  return (
    <button
      onClick={onClick}
      role="radio"
      aria-checked={selected}
      className={`pressable a-up absolute left-[20px] flex h-[46px] w-[362px] items-center justify-center rounded-[10px] border text-[16px] ${
        selected ? "border-mint bg-mint font-semibold text-white" : "border-faint bg-chalk text-mute"
      }`}
      style={{ top, animationDelay: `${0.18 + index * 0.06}s` }}
    >
      {label}
    </button>
  );
}

function QuestionTitle({ title, sub }) {
  return (
    <>
      <T y={184} size={20} left={36} className="a-up font-semibold text-mint">
        {title}
      </T>
      <T y={220} size={16} left={36} className="a-up text-gray" style={delay(0.06)}>
        {sub}
      </T>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · 학과 추천 질문                                                 */
/* ------------------------------------------------------------------ */

const progressFor = (step) => Math.max(0.04, step / QUESTIONS.length);

// 질문마다 보기 하나를 고르고 다음으로 넘어간다. 들어올 때마다 지난번 답은 비우고 새로 시작한다.
export function Quiz({ nav, state, setState }) {
  const [step, setStep] = useState(1);
  const [shake, setShake] = useState(0);
  useEffect(() => {
    setState((s) => ({ ...s, answers: {} }));
  }, [setState]);

  const back = () => (step === 1 ? nav.back() : setStep((s) => s - 1));
  const q = QUESTIONS[step - 1];
  const answer = state.answers[step] ?? null;
  const pick = (label) => setState((s) => ({ ...s, answers: { ...s.answers, [step]: label } }));
  const next = () => {
    if (!answer) return setShake((n) => n + 1);
    if (step < QUESTIONS.length) setStep(step + 1);
    else nav.replace("result", undefined, "fade");
  };

  return (
    <Screen
      h={295 + q.options.length * 62}
      resetOn={step}
      footer={<OutlineButton onClick={next}>{step < QUESTIONS.length ? "다음" : "추천 결과 보기"}</OutlineButton>}
    >
      <Header title="나에게 맞는 학과 찾기" count={`${step}/${QUESTIONS.length}`} onBack={back} />
      <ProgressBar value={progressFor(step)} />
      <Fragment key={step}>
        <QuestionTitle title={q.title} sub={q.sub} />
        <div key={`s${shake}`} className={shake ? "a-shake" : ""} role="radiogroup" aria-label={q.title}>
          {q.options.map((opt, i) => (
            <OptionButton key={opt.label} index={i} top={295 + i * 62} label={opt.label} selected={answer === opt.label} onClick={() => pick(opt.label)} />
          ))}
        </div>
      </Fragment>
    </Screen>
  );
}

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

// 제휴 학교 표시. 글은 하나만 둔다(보이는 글과 읽어 주는 글을 따로 두면 글을 읽어 가는 곳에서 두 번 나온다).
// 예시 제휴라는 것은 배지가 아니라 화면의 안내 문구(PARTNER_EXAMPLE_NOTE)로 알린다.
function PartnerBadge() {
  return (
    <span className="flex h-[18px] shrink-0 items-center whitespace-nowrap rounded-full border border-mint bg-mint-soft px-[6px] text-[10px] font-semibold leading-none text-mint-deep">
      {PARTNER_LABEL}
    </span>
  );
}

// 이름이 길면 이름만 말줄임하고 제휴 표시는 늘 보이게 둔다.
function NameWithBadge({ partner, children }) {
  return (
    <>
      <span className="min-w-0 truncate">{children}</span>
      {partner && <PartnerBadge />}
    </>
  );
}

function YellowCard({ top, title, partner = false, sub, onClick, className = "", style }) {
  return (
    <button
      onClick={onClick}
      className={`pressable absolute left-[20px] h-[80px] w-[362px] rounded-[16px] border border-cream-line bg-cream text-left active:bg-cream-2 ${className}`}
      style={{ top, ...style }}
    >
      <T y={20} size={16} left={15.5} className="flex items-center gap-[6px] font-semibold text-slate" style={{ maxWidth: 330 }}>
        <NameWithBadge partner={partner}>{title}</NameWithBadge>
      </T>
      <T y={48} size={11} left={16} clip={330} className="text-gray">
        {sub}
      </T>
    </button>
  );
}

// 학과를 열어 본다(학과 상세).
const openDepartment = (nav, setState, d) => {
  setState((s) => ({ ...s, current: d.id }));
  nav.push("detail");
};

export function Result({ active, nav, state, setState }) {
  const result = recommend(state.answers, all(state));
  useGuard(!!result, nav, active);
  if (!result) return null;
  const { best, others, count, total, tie } = result;
  const open = (d) => openDepartment(nav, setState, d);
  return (
    <Screen
      h={737}
      footer={
        <OutlineButton onClick={() => open(best)} className="a-up" style={delay(0.7)}>
          {`${best.name} 살펴보기`}
        </OutlineButton>
      }
    >
      <Header title="나에게 맞는 학과 찾기" onBack={nav.back} />
      <div className="a-pop absolute left-[117px] top-[149px] h-[124px] w-[140px]" style={delay(0.05)}>
        <img
          src={img.mascotResult}
          alt=""
          className="loop h-full w-full"
          style={{ animation: "sway 2.8s ease-in-out 0.8s infinite", transformOrigin: "50% 90%" }}
        />
      </div>
      <Confetti originX={187} originY={212} />
      <T y={310} size={20} left={37.5} clip={330} className="a-up font-semibold text-mint" style={delay(0.35)}>
        {tie ? "두 학과 모두에 끌리시네요!" : `${best.name}에 더 끌리시네요!`}
      </T>
      <button
        onClick={() => open(best)}
        className="pressable a-up absolute left-[20px] top-[355px] h-[180px] w-[362px] rounded-[16px] border border-mint text-left"
        style={{ background: "linear-gradient(180deg, #f0fcfb 0%, #d6f8f6 100%)", animationDelay: "0.45s" }}
      >
        <T y={22.5} size={12} left={17.5} className="font-medium text-mint">
          {tie ? "먼저 만나볼 학과" : "추천 학과"}
        </T>
        <T y={54} size={20} left={17} className="flex items-center gap-[6px] font-semibold text-slate" style={{ maxWidth: 330 }}>
          <NameWithBadge partner={best.partner}>{`${best.school} ${best.name}`}</NameWithBadge>
        </T>
        <T y={84.5} size={11} lh={17} left={17.5} clip={330} className="text-gray">
          {`질문 ${total}개 중 ${count}개의 답이 ${best.name} 쪽이었어요.\n${best.intro}`}
        </T>
        <div className="absolute left-[17px] top-[146px] flex gap-[8px]">
          {best.tags.map((tag) => (
            <TagPill key={tag}>{tag}</TagPill>
          ))}
        </div>
      </button>
      {others.map((d, i) => (
        <YellowCard
          key={d.id}
          top={550 + i * 95}
          title={`${d.name}도 궁금하다면?`}
          partner={d.partner}
          sub={d.intro}
          onClick={() => open(d)}
          className="a-up"
          style={delay(0.55 + i * 0.07)}
        />
      ))}
      {showsExampleNote(all(state)) && (
        <T y={550 + others.length * 95 + 4} size={10.5} left={24} className="a-fade text-gray" style={delay(0.7)}>
          {PARTNER_EXAMPLE_NOTE}
        </T>
      )}
    </Screen>
  );
}

/**
 * 학과 고르기: 학과 추천 카드와 학과 카드. 홈(입학 전)과 탐색 화면이 함께 쓴다. top부터 그리고, 다 그린 높이를 돌려준다.
 * 학과 데이터를 받는 중이거나 받지 못했으면 그 상태를 보여준다.
 */
function pickerHeight(count) {
  return 128 + count * 95 + 24;
}
function DepartmentPicker({ top, nav, state, setState, catalog }) {
  const list = all(state);
  const result = recommend(state.answers, list);
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
      <button
        onClick={() => nav.push("quiz")}
        className="pressable a-up absolute left-[20px] h-[112px] w-[362px] rounded-[16px] border border-mint text-left"
        style={{ top, background: "linear-gradient(180deg, #f0fcfb 0%, #d6f8f6 100%)", animationDelay: "0.2s" }}
      >
        <T y={20} size={12} left={17.5} className="font-medium text-mint">
          학과 추천
        </T>
        <T y={44} size={18} left={17} clip={330} className="font-semibold text-slate">
          {result ? `지난 추천: ${result.tie ? "두 학과 모두" : result.best.name}` : "나에게 맞는 학과 찾기"}
        </T>
        <T y={74} size={11} left={17.5} clip={330} className="text-gray">
          {result ? "다시 답하면 새로 추천해요" : `질문 ${QUESTIONS.length}개에 답하면 더 맞는 학과를 알려줘요`}
        </T>
      </button>
      {list.map((d, i) => (
        <YellowCard
          key={d.id}
          top={top + 128 + i * 95}
          title={`${d.school} ${d.name}`}
          partner={d.partner}
          sub={d.intro}
          onClick={() => openDepartment(nav, setState, d)}
          className="a-up"
          style={delay(0.28 + i * 0.06)}
        />
      ))}
      {showsExampleNote(list) && (
        <T y={top + 128 + list.length * 95 + 2} size={10.5} left={24} className="a-fade text-gray" style={delay(0.4)}>
          {PARTNER_EXAMPLE_NOTE}
        </T>
      )}
    </>
  );
}

// 탐색 탭: 학과 고르기.
export function Departments({ nav, state, setState, catalog }) {
  return (
    <Screen h={150 + pickerHeight(all(state).length)} foot={739} veil={false} footer={<TabBar active="explore" nav={nav} state={state} />}>
      <Header title="학과 둘러보기" onBack={nav.back} />
      <DepartmentPicker top={128} nav={nav} state={state} setState={setState} catalog={catalog} />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · 학과 상세                                                      */
/* ------------------------------------------------------------------ */

/** 입학증·성적표·졸업증명서의 도장. 위치와 크기는 세 화면이 같고, 등장 모션은 화면마다 넘겨받는다. */
function SchoolSeal({ d, className, style }) {
  return (
    <div className={`${className} absolute left-[112px] top-[308px] h-[40px] w-[53px]`} style={style}>
      <SchoolLogo school={d.school} partner={d.partner} kind="seal" size={40} />
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
  const { d, journey, total, finished } = v;
  const enroll = () => {
    if (finished) return nav.push("graduation");
    setState((s) => ({ ...s, studying: d.id }));
    if (journey) return nav.reset(["home"]);
    setState((s) => ({ ...s, journeys: { ...s.journeys, [d.id]: { completed: 0, paused: false } } }));
    nav.push("enrolled", undefined, "rise");
  };
  const subjects = Object.values(d.years).flat();
  return (
    <Screen
      h={Math.max(600, 528 + listH + 32)}
      footer={
        <OutlineButton onClick={enroll} className="a-up" style={delay(0.5)}>
          {finished ? "졸업 리포트 보기" : journey ? "이어서 체험하기" : `${d.name} 입학하기`}
        </OutlineButton>
      }
    >
      <BackButton onClick={nav.back} />
      <div className="a-up absolute left-[20px] top-[116px] h-[112px] w-[362px] rounded-[16px] border border-cream-line bg-cream">
        <div className="absolute left-[11px] top-[21px] h-[72px] w-[108px]">
          <SchoolLogo school={d.school} partner={d.partner} />
        </div>
        <T y={27} size={21} left={135.5} className="flex items-center gap-[6px] font-semibold text-slate" style={{ maxWidth: 215 }}>
          <NameWithBadge partner={d.partner}>{d.school}</NameWithBadge>
        </T>
        <T y={57} size={11} lh={17} left={135} clip={215} className="text-gray">
          {`${d.officialName}\n수업연한 ${d.duration} 과정`}
        </T>
      </div>
      {showsExampleNote([d]) && (
        <T y={231} size={10.5} left={24} className="a-fade text-gray" style={delay(0.1)}>
          {PARTNER_EXAMPLE_NOTE}
        </T>
      )}
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
          <TagPill>{`${d.duration} · ${total}학기 체험`}</TagPill>
          {d.tags.map((tag) => (
            <TagPill key={tag}>{tag}</TagPill>
          ))}
        </div>
      </div>
      <T y={441} size={16} left={33} className="a-up font-semibold text-slate" style={delay(0.16)}>
        이 학과는 이런 내용을 배워요
      </T>
      <T y={472.5} size={14} lh={20} left={33} clip={340} className="a-up text-slate/90" style={delay(0.2)}>
        {`학기마다 그 학년 편성표 과목 중 하나를 골라요\n민트색은 체험할 수 있고, 나머지는 구현 예정이에요 (${subjects.length}과목)`}
      </T>
      <div ref={list} className="a-up absolute left-[20px] right-[20px] top-[528px]" style={delay(0.28)}>
        <YearSubjects years={yearSubjects(d)} />
        <p className="footnote">
          {`출처: ${d.school} `}
          {d.source.url ? (
            <a href={d.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-[2px]">
              {d.source.title || "교육과정 편성표"}
            </a>
          ) : (
            d.source.title
          )}
          {". 4학년 2학기에는 졸업 과제를 해요."}
        </p>
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
  useGuard(!!v?.finished, nav, active);
  useAutoAdvance(next, 4600);
  if (!v?.finished) return null;
  const { d, skipped } = v;
  // 휴강한 과목이 있으면 A+ 도장 대신 학년마다 이수·미이수를 적는다.
  const missed = skipped.length > 0;
  return (
    <CertificateShell onBack={() => nav.reset(["home"])} onNext={next}>
      <div className="absolute inset-0 overflow-hidden rounded-[8px]">
        <T y={56} size={25} center className="a-up pl-[8px] font-bold text-mint" style={delay(0.45)}>
          성적표
        </T>
        <Statement y={104} d={0.6}>
          {missed
            ? `위 사람은 ${d.school} ${d.name}의\n체험 과정을 마쳤음을 증명합니다 (미이수 ${skipped.length}과목)`
            : `위 사람은 ${d.school} ${d.name}의\n체험 과정을 모두 마쳤음을 증명합니다`}
        </Statement>
        {missed && (
          <ul className="a-fade absolute left-[26px] top-[164px] w-[222px]" style={delay(0.7)} aria-label="과목별 이수 결과">
            {d.lessons.map((lesson, i) => (
              <li key={i} className="flex gap-[6px] text-[10px] leading-[16px] text-gray">
                <span className="shrink-0 tabular-nums text-mint-deep">{shortStage(d, i)}</span>
                <span className="min-w-0 flex-1 truncate">{lesson}</span>
                <span className={`shrink-0 font-semibold ${skipped.includes(i) ? "text-ink-2" : "text-mint-deep"}`}>
                  {skipped.includes(i) ? "미이수" : plannedAt(d, i) ? "구현 예정" : "이수"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {/* 학기별 학과는 학기마다 고른 과목을 적는다. */}
        {!missed && d.options && (
          <ul className="a-fade absolute left-[170px] top-[152px] w-[92px]" style={delay(0.7)} aria-label="학기별 이수 과목">
            {d.options.map((items, i) =>
              items ? (
                <li key={i} className="flex gap-[5px] text-[9.5px] leading-[16px] text-gray">
                  <span className="shrink-0 tabular-nums text-mint-deep">{shortStage(d, i)}</span>
                  <span className="min-w-0 truncate">{`${d.lessons[i]}${plannedAt(d, i) ? "(구현 예정)" : ""}`}</span>
                </li>
              ) : null,
            )}
          </ul>
        )}
        <BottomSign d={d} wait={0.7} />
        <SchoolSeal d={d} className="a-fade" style={delay(0.8)} />
        {!missed && (
          <img
            src={img.gradeAplus}
            alt="A+"
            className="absolute left-[-4px] top-[141px] h-[191px] w-[166px]"
            style={{ animation: "stamp 0.55s cubic-bezier(0.22,1,0.36,1) 1.05s both" }}
          />
        )}
        {(!missed || d.lessons.length <= 5) && (
          <img
            src={img.gradeSign}
            alt=""
            className="absolute left-[131px] top-[256px] h-[72px] w-[130px]"
            style={{ animation: "wipe 0.75s cubic-bezier(0.65,0,0.35,1) 1.75s both" }}
          />
        )}
      </div>
    </CertificateShell>
  );
}

export function Diploma({ active, nav, state }) {
  const v = view(state);
  const next = () => nav.replace("graduation", undefined, "fade");
  useGuard(!!v?.finished, nav, active);
  useAutoAdvance(next, 4200);
  if (!v?.finished) return null;
  const { d, skipped } = v;
  return (
    <CertificateShell onBack={() => nav.reset(["home"])} onNext={next}>
      <T y={56} size={25} center className="a-up pl-[8px] font-bold text-mint" style={delay(0.45)}>
        졸업증명서
      </T>
      <PaperRow y={117} left="체험생" right={`${d.school} ${d.name}`} d={0.6} />
      <Statement y={168} d={0.8}>
        {`위 사람은 ${d.school} ${d.name}\n체험 과정을 졸업하였음을 증명합니다`}
        {skipped.length > 0 && (
          <span className="mt-[2px] block truncate text-[10px] leading-[16px] text-ink-3">
            {`미이수 ${skipped.length}과목 · ${skipped.map((i) => d.lessons[i]).join(", ")}`}
          </span>
        )}
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
  return (
    <Screen
      h={725}
      foot={725}
      footer={
        <>
          <button
            onClick={() => nav.reset(["home"], "fade")}
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
      <div className="a-drop absolute left-[70px] top-[171px] h-[252px] w-[244px]" style={delay(0.3)}>
        <img
          src={img.mascotWelcome}
          alt=""
          className="loop h-full w-full"
          style={{ animation: "hop 2.4s ease-in-out 1.3s infinite", transformOrigin: "50% 100%" }}
        />
      </div>
      <T y={458} size={d.name.length > 9 ? 21 : 28.5} lh={42} center clip={380} className="a-up font-bold text-ink" style={delay(0.6)}>
        {`반가워요,\n${d.name} 새내기!`}
      </T>
      <T y={549.5} size={14.5} center className="a-up text-ink-3" style={delay(0.7)}>
        나에게 맞는 전공인지, 직접 경험하며 알아봐요.
      </T>
      <div className="a-up absolute left-0 top-[603px] h-[115px] w-[402px] rounded-[28px] bg-cream-2" style={delay(0.8)}>
        <T y={27} size={16.5} center clip={360} className="font-bold text-ink-2">
          {`${stageLabel(d, 0)} · ${d.lessons[0]}`}
        </T>
        <T y={62.5} size={13.5} lh={20} center className="text-ink-3">
          {"학기마다 그 학년 과목을 골라 체험하고\n4학년 2학기에는 졸업 과제에 도전해요."}
        </T>
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

const TABS = [
  { id: "home", label: "홈", icon: icon.home, w: 38, h: 38, x: 33, y: 762, cx: 52 },
  { id: "explore", label: "탐색", icon: icon.explore, w: 40, h: 39, x: 125, y: 761, cx: 145 },
  { id: "major", label: "전공", icon: icon.major, w: 37, h: 39, x: 224, y: 761, cx: 242.5 },
  { id: "my", label: "마이페이지", icon: icon.my, w: 40, h: 39, x: 316, y: 761, cx: 336 },
];

function TabBar({ active, nav, state }) {
  const go = (id) => {
    if (id === active) return;
    if (id === "home") nav.reset(["home"]);
    if (id === "explore") nav.push("departments");
    // 전공: 지금 보고 있는(또는 체험 중인) 학과의 상세. 아직 고른 학과가 없으면 학과 둘러보기로 간다.
    if (id === "major") nav.push(state.current ? "detail" : "departments");
    if (id === "my") nav.push("my");
  };
  return (
    <div className="absolute left-0 top-[739px] h-[135px] w-full border-t border-mint bg-white">
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => go(t.id)}
            aria-current={on ? "page" : undefined}
            className="pressable absolute"
            style={{ left: t.cx - 44, top: 16, width: 88, height: 70 }}
          >
            <Mask
              src={t.icon}
              w={t.w}
              h={t.h}
              color={on ? "#27d8cd" : "#c4c4c4"}
              className="absolute"
              style={{ left: t.x - (t.cx - 44), top: t.y - 739 - 16 }}
            />
            <T y={807 - 739 - 16} size={12.5} center className={on ? "font-medium text-mint" : "font-medium text-[#c4c4c4]"}>
              {t.label}
            </T>
          </button>
        );
      })}
    </div>
  );
}

// 체험의 이름: 전공 실습이면 그 틀(예: 순서 맞추기), 아니면 연습 문제 유형.
const kindOf = (d, id) => (id.startsWith("group:") && d.practice ? `전공 실습(${templates[d.practice.template].title})` : lessonTypes[id]?.title || "");

/** 과제 하나가 어떤 활동인지 한 줄로. */
function taskKind(d, index) {
  if (index === d.lessons.length - 1) return "졸업 과제";
  if (d.options?.[index] && !d.chosen?.[index]) return `${d.yearNumbers[index]}학년 과목 ${d.options[index].length}개 중 하나를 골라요`;
  const id = d.games?.[index];
  return (typeof id === "string" && kindOf(d, id)) || "체험 구현 예정";
}

/**
 * 아직 순서가 오지 않은 과제. 누르면 언제 열리는지 잠깐 알려준다.
 * 제휴 잠금과 헷갈리지 않게 자물쇠 대신 오른쪽에 "{N}학년에 열려요"를 회색 글씨로 적는다.
 */
function TaskCard({ top, title, sub, opens, hint, onClick, d }) {
  return (
    <button
      onClick={onClick}
      aria-label={`${title}, ${sub}, ${opens}에 열려요`}
      className="pressable a-up absolute left-[21px] flex h-[69px] w-[365px] items-center gap-[10px] rounded-[10px] border border-[#a4acb6] bg-chalk pl-[14px] pr-[14px] text-left"
      style={{ top, animationDelay: `${d}s` }}
    >
      <Mask src={icon.eye} w={19} h={19} color="#827d76" />
      {/* 이름과 유형은 왼쪽에서 남는 폭만큼만 쓰고 말줄임한다. 오른쪽 "{N}학년에 열려요"는 줄지 않는다(학년 과목의 체험하기와 같은 글자). */}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-semibold leading-[20px] text-ink-2">{title}</span>
        <span key={hint || "sub"} className={`truncate text-[10.5px] leading-[16px] ${hint ? "a-shake text-mint-deep" : "text-ink-3"}`}>
          {hint || sub}
        </span>
      </span>
      <span className="shrink-0 text-[12.5px] font-semibold text-black">{`${opens}에 열려요`}</span>
    </button>
  );
}

// 입학 전 홈: 학과 추천과 학과 카드.
function HomeStart({ nav, state, setState, catalog }) {
  const list = all(state);
  const schools = [...new Set(list.map((d) => d.school))];
  return (
    <Screen h={250 + pickerHeight(list.length)} foot={739} veil={false} footer={<TabBar active="home" nav={nav} state={state} />}>
      <Mask src={icon.cap} w={24} h={18} color="#087f77" className="absolute left-[23px] top-[59px]" />
      <T y={61} size={16} center clip={270} className="font-semibold text-mint">
        {schools.length === 1 ? schools[0] : "캠퍼스하이"}
      </T>
      <T y={122.5} size={28.5} lh={36} left={20} className="a-up font-bold text-navy">
        {"어떤 전공이\n나에게 맞을까?"}
      </T>
      <T y={201.5} size={14.5} left={20.5} clip={230} className="a-up text-gray" style={delay(0.08)}>
        학과에 입학해 학기마다 수업을 체험해요.
      </T>
      <div className="a-pop absolute left-[244px] top-[104px] h-[106px] w-[143px]" style={delay(0.2)}>
        <img src={img.mascotHome} alt="" className="loop h-full w-full" style={{ animation: "float 2.6s ease-in-out 0.9s infinite" }} />
      </div>
      <DepartmentPicker top={250} nav={nav} state={state} setState={setState} catalog={catalog} />
    </Screen>
  );
}

export function Home({ active, nav, state, setState, catalog }) {
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
  const percent = v?.journey ? Math.round((v.completed / v.total) * 100) : 0;
  const pct = useCountUp(percent);
  // 아직 순서가 오지 않은 과제를 눌렀을 때 그 카드에 보여줄 안내.
  const [hint, setHint] = useState(null);
  const hintTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(hintTimer.current), []);
  if (!v?.journey) return fallback ? null : <HomeStart nav={nav} state={state} setState={setState} catalog={catalog} />;
  const { d, total, completed, index, year, finished, skipped, passed } = v;
  const tellLocked = (i) => {
    const before = stageLabel(d, i - 1);
    setHint({ i, text: i - 1 === index ? `지금 하는 ${before} 수업을 마치면 열려요` : `${before} 수업을 마치면 열려요` });
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 2400);
  };
  // 학기 자리에서 아직 과목을 고르지 않았으면 과목 고르기부터 한다.
  const choosing = !finished && !!d.options?.[index] && !d.chosen?.[index];
  const open = () => (finished ? nav.push("graduation") : nav.push(choosing ? "choose" : "lesson"));
  const label = stageLabel(d, index);
  // 지금 과제 다음에 남은 과제(최대 2개).
  const upcoming = finished ? [] : d.lessons.map((lesson, i) => ({ lesson, i })).slice(index + 1, index + 3);
  // 남은 과제 아래에 휴강한(미이수) 과목을 다시 들을 수 있게 둔다.
  const listEnd = (upcoming.length ? 565 + upcoming.length * 84 : 615);
  // 맨 아래에 학과 추천과 학과 카드(다른 학과도 둘러볼 수 있게).
  const pickerTop = (skipped.length ? listEnd + 52 + skipped.length * 84 : listEnd) + 52;
  return (
    <Screen h={pickerTop + pickerHeight(all(state).length)} foot={739} veil={false} footer={<TabBar active="home" nav={nav} state={state} />}>
      <Mask src={icon.cap} w={24} h={18} color="#087f77" className="absolute left-[23px] top-[59px]" />
      <T y={61} size={16} center clip={270} className="font-semibold text-mint">
        {d.school}
      </T>
      <Mask
        src={icon.bell}
        w={22}
        h={24}
        color="#949494"
        className="loop absolute left-[356px] top-[56px] origin-top"
        style={{ animation: "sway 1.2s ease-in-out 1.2s 2" }}
      />
      <T y={122.5} size={28.5} lh={36} left={20} className="a-up font-bold text-navy">
        {"한 걸음씩,\n나의 전공을 알아가는 중"}
      </T>
      <T y={201.5} size={14.5} left={20.5} className="a-up text-gray" style={delay(0.08)}>
        {finished ? "모든 과정을 마쳤어요. 졸업을 축하해요!" : `오늘은 ${label} 수업을 만나봐요.`}
      </T>
      <T y={263.5} size={d.name.length > 8 ? 15 : 19.5} left={20} clip={190} className="a-up font-bold text-ink-2" style={delay(0.14)}>
        {d.name}
      </T>
      <T y={294.5} size={12.5} lh={16} left={20.5} clip={170} className="a-up text-mint-deep" style={delay(0.18)}>
        {`${label} · ${d.lessons[index]}\n${skipped.length ? `${passed} / ${total} 이수 · 미이수 ${skipped.length}` : `학습·실습 ${completed} / ${total} 완료`}`}
      </T>
      <div className="a-pop absolute left-[174px] top-[261px] h-[154px] w-[208px]" style={delay(0.2)}>
        <img src={img.mascotHome} alt="" className="loop h-full w-full" style={{ animation: "float 2.6s ease-in-out 0.9s infinite" }} />
      </div>
      <T y={400.5} size={12.5} left={20} className="text-gray">
        졸업까지
      </T>
      <T y={401.5} size={14} left={70.5} className="font-bold text-mint-deep">
        {pct}%
      </T>
      <div
        className="absolute left-[20px] top-[423px] h-[8.5px] w-[362px] overflow-hidden rounded-full bg-track"
        role="progressbar"
        aria-label="졸업까지 진행도"
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
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
          {finished ? "졸업 리포트 보기" : choosing ? `${label} 과목 고르기` : `${d.lessons[index]} ${completed ? "이어하기" : "시작하기"}`}
        </span>
      </button>
      <T y={535.5} size={15} left={21} className="a-up font-bold text-ink-2" style={delay(0.36)}>
        졸업까지 남은 과제
      </T>
      {upcoming.map(({ lesson, i }, n) => (
        <TaskCard
          key={i}
          top={565 + n * 84}
          d={0.42 + n * 0.06}
          title={lesson}
          sub={taskKind(d, i)}
          opens={stageLabel(d, i)}
          hint={hint?.i === i ? hint.text : ""}
          onClick={() => tellLocked(i)}
        />
      ))}
      <p className="sr-only" role="status">
        {hint?.text}
      </p>
      {upcoming.length === 0 && (
        <T y={585} size={13} left={21} className="a-up text-ink-3" style={delay(0.42)}>
          {finished ? "모든 과제를 마쳤어요." : "지금 하는 과제가 마지막이에요."}
        </T>
      )}
      {skipped.length > 0 && (
        <T y={listEnd + 12} size={15} left={21} className="a-up font-bold text-ink-2" style={delay(0.5)}>
          휴강한 과목 다시 듣기
        </T>
      )}
      {skipped.map((i, n) => (
        <button
          key={`skipped-${i}`}
          onClick={() => nav.push("lesson", { retake: i })}
          aria-label={`${stageLabel(d, i)} ${d.lessons[i]}, 미이수, 다시 듣기`}
          className="pressable a-up absolute left-[21px] h-[69px] w-[365px] rounded-[10px] border border-mint bg-white text-left"
          style={{ top: listEnd + 42 + n * 84, animationDelay: `${0.56 + n * 0.06}s` }}
        >
          <T y={19} size={14} left={16} clip={250} className="font-semibold text-ink-2">
            {d.lessons[i]}
          </T>
          <T y={41.5} size={10.5} left={16.5} clip={250} className="text-ink-3">
            {`${stageLabel(d, i)} · 미이수 · 다시 들으면 이수로 바뀌어요`}
          </T>
          <span className="absolute right-[14px] top-[22px] flex h-[24px] items-center rounded-full bg-mint-soft px-[10px] text-[12px] font-semibold text-mint-deep">
            다시 듣기
          </span>
        </button>
      ))}
      <T y={pickerTop - 30} size={15} left={21} className="a-up font-bold text-ink-2" style={delay(0.5)}>
        학과 둘러보기
      </T>
      <DepartmentPicker top={pickerTop} nav={nav} state={state} setState={setState} catalog={catalog} />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 12 · 학년별 수업                                                    */
/* ------------------------------------------------------------------ */

const STEPS = ["배우기", "직접 해보기", "기록"];

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
  const n = game.items.length;
  if (game.type === "blank") return `문장 ${n}개의 빈칸에 알맞은 말을 골라요.`;
  if (game.type === "ox") return `문장 ${n}개가 맞는지 O, X로 골라요.`;
  if (game.type === "order") return `${n}단계를 올바른 순서로 놓아요.`;
  if (game.type === "match") return `서로 관련된 ${n}쌍의 짝을 맞춰요.`;
  return `${n}개를 알맞은 칸으로 나눠요.`;
}
export function Lesson({ active, nav, route, state, setState }) {
  // 이 화면은 들어올 때의 수업 하나를 끝까지 다룬다. retake가 있으면 휴강했던(미이수) 그 자리를 다시 듣는다.
  const [v] = useState(() => view(state, route?.params?.retake));
  const ok = !!v?.journey && (!v.finished || v.retake);
  const key = ok ? `${v.d.id}-${v.index}` : "";
  const subject = ok ? v.d.lessons[v.index] : "";
  const isFinal = ok && v.index === v.total - 1;
  // 학기 자리에서 과목을 아직 고르지 않았으면(새로고침 등) 과목 고르기로 보낸다.
  const unchosen = ok && !!v.d.options?.[v.index] && !v.d.chosen?.[v.index];
  const game = ok && !isFinal ? v.d.games?.[v.index] || null : null;
  // 학과군 전공 실습이면 그 체험 데이터. 아니면 연습 문제 유형(이론 수업)이거나 null(체험 구현 예정).
  const practice = typeof game === "string" && game.startsWith("group:") ? v.d.practice : null;
  const typed = !practice && isLessonType(game);
  const quiz = useLessonGame(typed ? subject : null);
  const [draft, setDraft] = useState(() => (ok ? state.drafts[key] ?? state.notes[key] ?? "" : ""));
  // 체험이나 기록을 이미 시작한 수업은 기록 단계부터 이어간다.
  const [step, setStep] = useState(() => (ok && ((game && state.plays[key]) || state.drafts[key]) ? 2 : 0));
  const [reached, setReached] = useState(step);
  const [notice, setNotice] = useState("");
  const [shake, setShake] = useState(0);
  // 휴강 확인 창을 띄웠는지.
  const [skipping, setSkipping] = useState(false);
  const timer = useRef(0);
  const scroller = useRef(null);
  const heading = useRef(null);
  const moved = useRef(false);
  useGuard(ok, nav, active);
  useEffect(() => {
    if (active && unchosen) nav.replace("choose");
  }, [active, unchosen, nav]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // 연습 문제가 없어졌거나 형식이 맞지 않으면(404·422) 구현 예정 과목처럼 넘어갈 수 있게 체험을 마친 것으로 기록한다.
  useEffect(() => {
    if (typed && quiz.status === "basic")
      setState((s) => (s.plays[key]?.game === game ? s : { ...s, plays: { ...s.plays, [key]: { game, summary: "" } } }));
  }, [typed, quiz.status, key, game, setState]);
  // 단계를 옮기면 맨 위로 올리고 제목에 초점을 둔다(스크린 리더가 새 단계를 읽게).
  useEffect(() => {
    if (!moved.current) return;
    if (scroller.current) scroller.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  if (!ok || unchosen) return null;

  const { d, index, total, year, final, retake } = v;
  const label = stageLabel(d, index);
  const header = <Header title={`${label} · ${subject}`} count={`${index + 1}/${total}`} onBack={nav.back} />;
  // 휴강: 미이수로 기록하고 다음 자리로 넘어간다. 쓰던 기록은 다시 들을 때 이어서 쓰도록 남긴다.
  const skip = () => {
    window.clearTimeout(timer.current);
    setSkipping(false);
    setState((s) => skipLesson(draft ? { ...s, drafts: { ...s.drafts, [key]: draft } } : s, d.id, index));
    if (isFinal) nav.replace("grades", undefined, "fade");
    else nav.reset(["home"]);
  };
  const skipDialog = skipping && (
    <Dialog
      title="이 과제를 건너뛸까요?"
      onClose={() => setSkipping(false)}
      actions={
        <>
          <button className="button" onClick={() => setSkipping(false)}>
            계속 풀기
          </button>
          <button className="button ghost" onClick={skip}>
            휴강하기
          </button>
        </>
      }
    >
      건너뛴 과제는 성적표에 ‘미이수’로 남아요. 나중에 다시 들을 수 있어요.
    </Dialog>
  );
  const skipButton = (className, style) =>
    retake ? null : (
      <button onClick={() => setSkipping(true)} className={`pressable text-[13px] text-gray underline underline-offset-[3px] ${className}`} style={style}>
        이번엔 자체 휴강할게요
      </button>
    );

  // 체험이 아직 없는 과목: 구현 예정이라고 알리고 다음 학기로 넘어간다. 성적표·리포트에는 '구현 예정'으로 남는다.
  if (!isFinal && !practice && (!typed || quiz.status === "basic")) {
    const pass = () => {
      setState((s) => completeLesson(s, d.id, index, ""));
      nav.reset(["home"]);
    };
    return (
      <Screen foot={700} footer={<FilledButton onClick={pass}>{retake ? "이수로 바꾸고 홈으로" : "다음 학기로 넘어가기"}</FilledButton>}>
        {header}
        <div className="flow no-scrollbar absolute bottom-[174px] left-0 top-[100px] w-full overflow-y-auto px-[20px] pt-[18px]">
          <h1 className="a-up text-[26px] font-bold leading-[36px] text-navy">{subject}</h1>
          <p className="a-up mt-[6px] text-[14px] leading-[22px] text-gray" style={delay(0.06)}>
            {`${label} 수업 · ${d.name}`}
          </p>
          <MintCard title="체험 구현 예정" className="a-up mt-[22px]">
            <p style={delay(0.1)}>이 과목의 체험은 아직 만들고 있어요. 지금은 과목만 확인하고 다음 학기로 넘어가요. 성적표와 리포트에는 ‘구현 예정’으로 남아요.</p>
          </MintCard>
          {d.options?.[index] && !retake && (
            <button className="text-button a-up mt-[14px]" onClick={() => nav.replace("choose")} style={delay(0.16)}>
              다른 과목 고르기 →
            </button>
          )}
        </div>
      </Screen>
    );
  }

  if (isFinal && final.kind === "artwork")
    return (
      <Screen overlay={skipDialog}>
        <Header title={d.name} count={`${index + 1}/${total}`} onBack={nav.back} />
        {skipButton("absolute right-[20px] top-[84px] z-20 h-[28px]")}
        <Rub
          data={final}
          year={year}
          onQuit={nav.back}
          onDone={() => {
            setState((s) => completeLesson({ ...s, artworks: { ...s.artworks, [d.id]: true } }, d.id, index, ""));
            nav.replace("grades", undefined, "fade");
          }}
        />
      </Screen>
    );

  // 수업의 종류: 졸업 프로젝트(AI 가르치기 등), 학과군 전공 실습, 연습 문제(불러오는 중·오류 포함).
  const mode = isFinal ? "project" : practice ? "practice" : quiz.status === "ready" ? "quiz" : quiz.status;
  const play = game && state.plays[key]?.game === game ? state.plays[key] : null;
  const played = play?.summary || "";
  const projectDone = !!state.artworks[d.id];
  const tried =
    mode === "project" ? projectDone : !!played;

  const headline = mode === "project" ? final.name : mode === "practice" ? practice.title : mode === "quiz" ? quiz.game.title : subject;
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
    if (!tried) return warn("먼저 직접 해보기를 끝까지 해보세요.");
    // 느낀 점은 적지 않아도 된다. 비어 있으면 기록 없이 완료한다(건너뛰기).
    window.clearTimeout(timer.current);
    setState((s) => completeLesson(s, d.id, index, draft));
    if (isFinal) nav.replace("grades", undefined, "fade");
    else nav.reset(["home"]);
  };
  const next = d.lessons[index + 1];
  const written = !!draft.trim();

  let body;
  let action;
  if (step === 0) {
    const task =
      mode === "project" ? final.task
      : mode === "practice" ? practice.task
      : mode === "quiz" ? quizTask(quiz.game)
      : null;
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
        {(mode === "practice" || mode === "project") && (mode === "practice" ? practice : final).learn && (
          <MintCard title="알아두기" className="a-up mt-[22px]">
            <p style={delay(0.1)}>{(mode === "practice" ? practice : final).learn}</p>
          </MintCard>
        )}
        {task && (
          <MintCard
            title="이 수업에서 해볼 것"
            className={`a-up ${(mode === "practice" || mode === "project") && (mode === "practice" ? practice : final).learn ? "mt-[12px]" : "mt-[22px]"}`}
          >
            <p style={delay(0.12)}>{task}</p>
          </MintCard>
        )}
        {d.options?.[index] && !state.plays[key] && !retake && (
          <button className="text-button a-up mt-[14px]" onClick={() => nav.replace("choose")} style={delay(0.16)}>
            다른 과목 고르기 →
          </button>
        )}
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
        {mode === "project" && (
          <LessonGame
            game={final}
            played={projectDone ? "졸업 과제를 끝까지 해봤어요" : ""}
            onComplete={() => {
              setNotice("");
              setState((s) => ({ ...s, artworks: { ...s.artworks, [d.id]: true } }));
            }}
          />
        )}
        {(mode === "practice" || mode === "quiz") && (
          <LessonGame
            game={mode === "practice" ? practice : quiz.game}
            played={played}
            onComplete={(summary) => {
              setNotice("");
              setState((s) => ({ ...s, plays: { ...s.plays, [key]: { game, summary } } }));
            }}
          />
        )}
      </div>
    );
    action = (
      <FilledButton onClick={() => (tried ? go(2) : warn("먼저 끝까지 해보세요."))}>
        기록하러 가기
      </FilledButton>
    );
  } else {
    body = (
      <>
        {(mode === "quiz" || mode === "project" || (mode === "practice" && practice.learn)) && (
          <MintCard title="배운 내용" className="a-up mt-[22px]">
            <p>{mode === "quiz" ? quiz.game.explanation : mode === "project" ? final.explanation : practice.learn}</p>
          </MintCard>
        )}
        {played && (
          <p className="a-up mt-[14px] text-[13px] leading-[20px] text-mint-deep" style={delay(0.06)}>
            오늘 해본 것 · {played}
          </p>
        )}
        <label className="note-card a-up mt-[16px] block" style={delay(0.12)}>
          <strong>{isFinal ? "체험을 마치며 남기는 생각" : "한 줄 기록"}</strong>
          <textarea
            className="compact"
            rows={2}
            placeholder={
              isFinal
                ? "이 전공을 체험하며 알게 된 점이나 달라진 생각을 남겨요."
                : "직접 해보니 어땠나요? 느낀 점을 한 줄로 남겨요."
            }
            value={draft}
            maxLength={3000}
            onChange={(e) => edit(e.target.value)}
          />
          <small>{draft.length.toLocaleString()} / 3,000자</small>
        </label>
      </>
    );
    // 적은 내용이 있으면 저장, 없으면 건너뛰기로 버튼이 바뀐다.
    const label = isFinal
      ? written ? `${final.name} 제출하고 ${retake ? "이수하기" : "졸업하기"}` : `생각은 건너뛰고 ${final.name} 제출하기`
      : written ? "기록 저장하고 완료하기" : "기록 건너뛰고 완료하기";
    action = <FilledButton onClick={finish}>{label}</FilledButton>;
  }

  // 아래 안내: 경고가 있으면 경고를, 기록 단계에서는 저장하면 어떻게 되는지를 보여준다.
  const verb = written ? "저장하면" : "건너뛰면";
  const guide =
    notice ||
    (step === 2
      ? retake
        ? `${verb} 미이수가 이수로 바뀌어요`
        : isFinal
          ? `${verb} 졸업이에요`
          : `${verb} ${index + 1} / ${total} 완료 · 다음은 ${stageLabel(d, index + 1)} ${next}`
      : "");
  return (
    <Screen
      foot={700}
      overlay={skipDialog}
      footer={
        <>
          {/* 이전 단계(첫 단계에서는 없음)와 휴강. 주 버튼과 구분되게 글씨 버튼으로 둔다. */}
          <div className="absolute inset-x-[20px] top-[708px] flex h-[36px] items-center justify-between">
            {step > 0 ? (
              <button onClick={() => go(step - 1)} className="pressable h-[36px] rounded-full border border-line bg-white px-[14px] text-[13px] font-semibold text-slate">
                ← 이전 단계
              </button>
            ) : (
              <span />
            )}
            {skipButton("h-[36px]")}
          </div>
          {action}
          <p
            key={shake}
            role="status"
            className={`absolute inset-x-[20px] top-[818px] overflow-hidden text-ellipsis whitespace-nowrap text-center text-[12.5px] leading-[20px] ${notice ? "a-shake text-mint-deep" : "text-gray"}`}
          >
            {guide}
          </p>
        </>
      }
    >
      {header}
      <StepChips step={step} reached={reached} onGo={go} />
      <div
        ref={scroller}
        className="flow no-scrollbar absolute left-0 top-[146px] w-full overflow-y-auto px-[20px] pb-[20px] pt-[18px]"
        style={{ bottom: "calc(174px - var(--bt) * 1px)" }}
      >
        <div key={step}>
          <h1 ref={heading} tabIndex={-1} className="a-up text-[26px] font-bold leading-[36px] text-navy outline-none">
            {headline}
          </h1>
          <p className="a-up mt-[6px] text-[14px] leading-[22px] text-gray" style={delay(0.06)}>
            {isFinal ? `${label} · 졸업 과제 · ${subject}` : practice ? `${label} 수업 · ${subject} · ${groupName(d.studyGroup)} 전공 실습` : `${label} 수업 · ${subject}`}
            {retake ? " · 다시 듣기" : ""}
          </p>
          {body}
        </div>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* 12-1 · 학기 과목 고르기 (제휴 대학의 학기별 편성이 있는 학과)         */
/* ------------------------------------------------------------------ */

export function Choose({ active, nav, state, setState }) {
  const v = view(state);
  const options = v?.journey && !v.finished && !v.journey.paused ? v.d.options?.[v.index] : null;
  useGuard(!!options, nav, active);
  if (!options) return null;
  const { d, index, total } = v;
  const label = stageLabel(d, index);
  const current = state.choices[`${d.id}-${index}`] || null;
  // 다른 학기에 이미 고른 과목은 다시 고를 수 없다.
  const taken = new Set(d.options.map((items, i) => (items && i !== index ? state.choices[`${d.id}-${i}`] : null)).filter(Boolean));
  // 체험이 있는 과목을 먼저, 구현 예정 과목을 그다음, 고를 수 없는 과목을 맨 뒤에 둔다. 그 안에서는 편성표 순서다.
  const items = options
    .map((subject) => ({ subject, type: gameOf(d, subject), taken: taken.has(subject) }))
    .sort((a, b) => a.taken - b.taken || !a.type - !b.type);
  const ready = items.filter((item) => item.type && !item.taken).length;
  // 예시 제휴 대학이면 첫 학기 과목 고르기에서 한 번만 예시라고 알린다.
  const exampleNote = d.partnerExample && d.options.findIndex(Boolean) === index;
  const pick = (subject) => {
    setState((s) => chooseSubject(s, d.id, index, subject));
    nav.replace("lesson");
  };
  return (
    <Screen>
      <Header title={`${label} · 과목 고르기`} count={`${index + 1}/${total}`} onBack={nav.back} />
      <div className="flow no-scrollbar absolute bottom-0 left-0 top-[100px] w-full overflow-y-auto px-[20px] pb-[32px] pt-[12px]">
        <h1 className="a-up whitespace-pre-line text-[24px] font-bold leading-[34px] text-navy">{`${label}에 들을 과목을\n하나 골라요`}</h1>
        <p className="a-up mt-[8px] text-[13.5px] leading-[21px] text-gray" style={delay(0.06)}>
          {`${d.school} ${d.name} 편성표의 ${d.yearNumbers[index]}학년 과목 ${options.length}개예요. `}
          {ready ? `지금 체험할 수 있는 과목은 ${ready}개이고, 나머지는 구현 예정이에요.` : "이 학년 과목의 체험은 모두 구현 예정이에요. 골라서 다음 학기로 넘어갈 수 있어요."}
        </p>
        {exampleNote && (
          <p className="a-up mt-[12px] rounded-[12px] border border-mint bg-mint-soft px-[14px] py-[10px] text-[12.5px] leading-[19px] text-mint-deep" style={delay(0.08)}>
            제휴 학교는 이렇게 학기별로 과목을 골라 체험할 수 있어요 (서비스 예시)
          </p>
        )}
        <ul className="mt-[18px] grid gap-[10px]">
          {items.map(({ subject, type, taken: used }, i) => (
            <li key={subject} className="a-up" style={delay(0.1 + Math.min(i, 8) * 0.03)}>
              <button
                onClick={() => pick(subject)}
                disabled={used}
                aria-pressed={current === subject}
                className={`pressable flex min-h-[62px] w-full items-center gap-[10px] rounded-[14px] border px-[16px] py-[10px] text-left ${
                  used
                    ? "border-faint bg-chalk opacity-60"
                    : current === subject
                      ? "border-mint bg-mint-soft"
                      : type
                        ? "border-cream-line bg-cream active:bg-cream-2"
                        : "border-line bg-white active:bg-chalk"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold leading-[22px] text-ink-2">{subject}</span>
                  <span className="block text-[12px] leading-[18px] text-gray">
                    {used ? "다른 학기에 고른 과목이에요" : type ? `${kindOf(d, type)}로 체험해요` : "체험을 만들고 있어요"}
                    {current === subject ? " · 지금 고른 과목" : ""}
                  </span>
                </span>
                {!used &&
                  (type ? (
                    <span className="flex h-[22px] shrink-0 items-center rounded-full border border-mint bg-white px-[8px] text-[11px] font-semibold text-mint-deep">
                      {type.startsWith("group:") ? "전공 실습" : "연습 문제"}
                    </span>
                  ) : (
                    <span className="flex h-[22px] shrink-0 items-center rounded-full border border-line bg-white px-[8px] text-[11px] font-semibold text-gray">
                      구현 예정
                    </span>
                  ))}
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

function lastNote(state, d) {
  for (let i = d.lessons.length - 1; i >= 0; i--) if (state.notes[`${d.id}-${i}`]) return state.notes[`${d.id}-${i}`];
  return "";
}

export function Graduation({ active, nav, state }) {
  const v = view(state);
  const ok = !!v?.finished;
  const grade = useCountUp(ok ? v.lastYear : 0, 700, 700);
  // 휴강한 과목은 이수에 넣지 않는다.
  const done = useCountUp(ok ? v.passed : 0, 900, 800);
  const pct = useCountUp(ok ? Math.round((v.passed / v.total) * 100) : 0, 1200, 900);
  useGuard(ok, nav, active);
  if (!ok) return null;
  const { d, total, skipped } = v;
  const title = `${d.school} ${d.name}`;
  return (
    <Screen
      h={754}
      foot={754}
      veil="#feeaa0"
      footer={
        <>
          <OutlineButton onClick={() => nav.reset(["home"], "fade")} className="a-up" style={delay(0.95)}>
            홈으로 가기
          </OutlineButton>
          <button
            onClick={() => nav.reset(["home", "departments"], "fade")}
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
          { v: `${grade}학년`, l: "체험 단계", cx: 71.5, y: 21, size: 20, ly: 46.5 },
          { v: `${done} / ${total}`, l: "학습 · 실습", cx: 198, y: 25.5, size: 19, ly: 51.5 },
          { v: `${pct}%`, l: skipped.length ? "이수율" : "체험 완료", cx: 327.5, y: 22.5, size: 20, ly: 46.5 },
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
            배운 내용
          </T>
          <div className="report-text absolute left-[20.5px] top-[124px] w-[360px] text-[12px] leading-[18px] text-ink-2" style={{ WebkitLineClamp: 2 }}>
            {d.lessons
              .map((lesson, i) => `${shortStage(d, i)} ${lesson}${skipped.includes(i) ? "(미이수)" : plannedAt(d, i) ? "(구현 예정)" : ""}`)
              .join(" · ")}
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
  const { completed, skipped, passed } = progressOf(state.journeys[d.id], d.lessons.length);
  const notes = d.lessons
    .map((lesson, i) => `${stageLabel(d, i)}. ${lesson}${skipped.includes(i) ? " [미이수]" : plannedAt(d, i) ? " [체험 구현 예정]" : ""}\n${state.notes[`${d.id}-${i}`] || "기록 없음"}`)
    .join("\n\n");
  const status = skipped.length
    ? `${completed} / ${d.lessons.length} 진행 · 이수 ${passed} · 미이수 ${skipped.length}`
    : `${completed} / ${d.lessons.length} 완료`;
  return `${d.school} ${d.name} 체험 리포트\n\n${status}\n\n${notes}`;
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
    .map(([id, journey]) => ({ d: all(state).find((item) => item.id === id && item.school), journey }))
    .filter((item) => item.d);
  const choose = (d, to) => {
    setState((s) => ({ ...s, current: d.id }));
    if (to === "home") nav.reset(["home"]);
    else nav.push(to);
  };
  return (
    <Screen foot={739} veil={false} footer={<TabBar active="my" nav={nav} state={state} />}>
      <Header title="마이페이지" onBack={nav.back} />
      <div
        className="flow no-scrollbar absolute left-0 top-[104px] w-full overflow-y-auto px-[20px] pb-[24px] pt-[20px]"
        style={{ bottom: "calc(135px - var(--bt) * 1px)" }}
      >
        <h1 className="a-up text-[20px] font-semibold leading-[28px] text-mint">나의 체험 기록</h1>
        <p className="a-up mt-[4px] text-[14px] leading-[22px] text-gray" style={delay(0.06)}>
          기록은 이 브라우저에만 저장돼요.
        </p>
        {journeys.length === 0 && <p className="a-fade mt-[40px] text-center text-[14px] text-mute">아직 체험한 학과가 없어요.</p>}
        {journeys.map(({ d, journey }, i) => {
          const total = d.lessons.length;
          const { completed, skipped, passed, finished } = progressOf(journey, total);
          const missed = skipped.length ? ` · 미이수 ${skipped.length}` : "";
          return (
            <div key={d.id} className="a-up mt-[14px] rounded-[16px] border border-cream-line bg-cream p-[16px]" style={delay(0.12 + Math.min(i, 6) * 0.06)}>
              <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-semibold text-slate">
                {d.school} {d.name}
              </strong>
              <p className="mt-[4px] text-[12px] leading-[18px] text-gray">
                {finished
                  ? skipped.length
                    ? `졸업 · ${passed} / ${total} 이수${missed}`
                    : `졸업 · 학습과 실습 ${total}개 완료`
                  : `${stageLabel(d, Math.min(completed, total - 1))} · ${completed} / ${total} 완료${missed}`}
              </p>
              <div className="mt-[12px] flex gap-[8px]">
                <button className="button" onClick={() => choose(d, finished ? "graduation" : "home")}>
                  {finished ? "졸업 리포트 보기" : "이어서 체험하기"}
                </button>
                {finished && (
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
            <button className="text-button" onClick={() => setConfirming(true)}>
              처음부터 다시 시작하기
            </button>
          )}
        </div>
      </div>
    </Screen>
  );
}

export const SCREENS = {
  splash: Splash,
  quiz: Quiz,
  result: Result,
  departments: Departments,
  detail: Detail,
  enrolled: Enrolled,
  welcome: Welcome,
  home: Home,
  lesson: Lesson,
  choose: Choose,
  grades: Grades,
  diploma: Diploma,
  graduation: Graduation,
  my: My,
};
