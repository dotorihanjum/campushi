// 학과 둘러보기와 학과 상세·입학.
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { BackButton, delay, OutlineButton, Screen, T, SchoolLogo } from "../ui.jsx";
import { isRequired, yearSubjects } from "../model.js";
import { groupName } from "../groups.js";
import { useGuard, view } from "./shared.jsx";

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

function TagPill({ children }) {
  return (
    <span className="flex h-[20px] items-center justify-center whitespace-nowrap rounded-full border border-mint bg-white/40 px-[9px] text-[9px] font-medium text-mint">
      {children}
    </span>
  );
}

// 예전 탐색 탭(학과 둘러보기). 탐색은 홈으로 합쳤으므로, 저장된 화면 기록 등으로 여기에 오면 홈의 학과 목록으로 보낸다.
export function Departments({ nav, active }) {
  useEffect(() => {
    if (active) nav.reset([["home", { focus: "departments" }]]);
  }, [active, nav]);
  return null;
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
    if (journey) return nav.reset(["home", "experience", "major"]);
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
