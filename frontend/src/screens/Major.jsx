// 학과 홈: N학년 해금까지, 학년 캐릭터, 들을 과목.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { yearCharacter } from "../assets.js";
import { BackButton, delay, FilledButton, Header, Screen, T } from "../ui.jsx";
import { gameOf, nextStepOf } from "../model.js";
import { PASS_GRADE } from "../grades.js";
import { CreditPill, TAB_TOP, TabBar, experienceName, latestJourney, useCountUp, view } from "./shared.jsx";

function CourseRow({ d, course, onClick }) {
  const sub =
    course.record && !course.passed
      ? `${course.record.grade} · ${PASS_GRADE} 이상이어야 이수돼요`
      : course.final
        ? `${course.year}학년 · 졸업 과제 · ${d.final.name}`
        : `${course.year}학년 · ${course.kind} · ${course.planned ? "체험을 만들고 있어요" : experienceName(d, gameOf(d, course.subject))}`;
  const badge = course.planned ? "구현 예정" : course.passed ? `${course.record.grade} · 다시 듣기` : course.record ? "재수강" : "듣기";
  return (
    <button
      onClick={onClick}
      aria-label={`${course.subject}${course.required ? ", 필수" : ""}, ${sub}, ${badge}`}
      className={`pressable flex h-[70px] w-full items-center gap-[10px] rounded-[10px] border bg-white px-[16px] text-left active:bg-mint-soft ${course.planned ? "border-line" : "border-mint"}`}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-[6px]">
          <span className={`truncate text-[14px] font-semibold leading-[20px] ${course.planned ? "text-slate" : "text-ink-2"}`}>{course.subject}</span>
          {course.required && <span className="shrink-0 text-[11px] font-bold text-mint">필수</span>}
        </span>
        <span className="truncate text-[11px] leading-[17px] text-ink-3">{sub}</span>
      </span>
      <span
        className={`flex h-[24px] shrink-0 items-center rounded-full px-[10px] text-[12px] font-semibold ${
          course.planned ? "border border-line text-gray" : course.passed ? "border border-mint bg-white text-mint-deep" : "bg-mint-soft text-mint-deep"
        }`}
      >
        {badge}
      </span>
    </button>
  );
}

/** 과목 카드 목록: 처음에는 SHOWN_TODO개만 보이고, 나머지는 더보기로 펼친다. */
function CourseList({ d, courses, nav, label }) {
  const [opened, setOpened] = useState(false);
  const id = useId();
  const shown = opened ? courses : courses.slice(0, SHOWN_TODO);
  const hidden = courses.length - SHOWN_TODO;
  return (
    <>
      <ul id={id} className="grid gap-[8px]" aria-label={label}>
        {shown.map((course) => (
          <li key={course.subject}>
            <CourseRow d={d} course={course} onClick={() => nav.push("lesson", { subject: course.subject })} />
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          className="pressable mt-[6px] flex h-[32px] items-center gap-[4px] rounded-[8px] pr-[4px] text-[12.5px] text-gray"
          aria-expanded={opened}
          aria-controls={id}
          onClick={() => setOpened((o) => !o)}
        >
          {opened ? "접기" : `더보기 (+${hidden})`}
          <svg width="10" height="6" viewBox="0 0 10 6" className={opened ? "rotate-180" : ""} aria-hidden>
            <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </>
  );
}

const SHOWN_TODO = 3;
// 학과 홈에서 과목 목록이 시작하는 높이(아트보드 기준).
const LIST_TOP = 528;

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
  // 아래 "다른 과목 더 듣기"에서 고른 학년(처음에는 바로 앞 학년).
  const [pickYear, setPickYear] = useState(null);
  // 과목 목록(펼치면 길어진다)의 높이를 재서 화면 높이를 정한다.
  const [listH, setListH] = useState(0);
  const watcher = useRef(null);
  const listRef = useCallback((el) => {
    watcher.current?.disconnect();
    watcher.current = null;
    if (!el) return;
    const update = () => setListH(el.offsetHeight);
    update();
    watcher.current = new ResizeObserver(update);
    watcher.current.observe(el);
  }, []);
  useEffect(() => () => watcher.current?.disconnect(), []);
  // 입학한 학과가 하나도 없으면 안내와 함께 학과를 고르러 갈 수 있게 한다.
  if (!v?.journey && !fallback)
    return (
      <Screen foot={TAB_TOP} veil={false} footer={<TabBar active="experience" root={false} nav={nav} state={state} />}>
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
  // 과목 순서: 체험이 있는 것 먼저, 그 안에서 필수 먼저, 안 들은 것 먼저.
  const order = (list) => [...list].sort((x, y) => x.planned - y.planned || y.required - x.required || x.passed - y.passed);
  // 졸업 전에는 "N학년 때는 이런 과목을 들어요"(이번 학년 과목 모두), 졸업한 뒤에는 아직 안 들은 체험 과목(모든 학년).
  const untaken = years.flatMap((item) => item.courses).filter((course) => !course.planned && !course.record);
  const todo = graduated ? untaken : order(now.courses);
  const open = () => nav.push("courses", { year: graduated ? (untaken[0]?.year ?? 4) : openYear });
  // 다른 과목 더 듣기: 지난 학년(1학년 ~ N-1학년, 졸업했으면 모든 학년) 가운데 고른 학년의 과목.
  const openYears = years.filter((item) => item.open && (graduated || item.year < openYear)).map((item) => item.year);
  // 처음에는 지금 학년 바로 앞에서부터 거슬러 올라가 들을 수 있는 과목이 있는 학년을 고른다(없으면 바로 앞 학년).
  const playable = (item) => years[item - 1].courses.some((course) => !course.planned);
  const fallbackYear = [...openYears].reverse().find(playable) ?? openYears.at(-1) ?? 1;
  const year = openYears.includes(pickYear) ? pickYear : fallbackYear;
  const more = order(years[year - 1].courses);
  // 위쪽에 학교와 소속 단과대학을 쓴다. 한 줄(가운데 220px)이 빠듯한 긴 이름(17자 이상, 예: 소프트웨어융합대학)은 학교 아래로 줄을 바꾼다.
  const affiliation = d.college || d.building;
  const place = affiliation ? `${d.school} · ${affiliation}` : d.school;
  const wrapPlace = Boolean(affiliation) && place.length > 16;
  return (
    <Screen h={LIST_TOP + listH + 24} foot={TAB_TOP} veil={false} footer={<TabBar active="experience" root={false} nav={nav} state={state} />}>
      <T y={wrapPlace ? 51 : 61} size={16} lh={wrapPlace ? 21 : undefined} center clip={220} className="font-semibold text-mint">
        {wrapPlace ? `${d.school}\n${affiliation}` : place}
      </T>
      <BackButton onClick={nav.back} />
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
        {`${graduated ? "졸업" : `${openYear}학년 진행 중`}\n이수 ${passedCount}과목${graduated ? ` · 안 들은 과목 ${todo.length}개` : ` · 남은 필수 ${step.total - step.done}개`}`}
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
      <div ref={listRef} className="absolute inset-x-[20px] pb-[8px]" style={{ top: LIST_TOP }}>
        <section aria-labelledby="major-now" className="a-up" style={delay(0.36)}>
          <h2 id="major-now" className="text-[15px] font-bold leading-[22px] text-ink-2">
            {graduated ? "아직 안 들은 과목" : `${openYear}학년 때는 이런 과목을 들어요`}
          </h2>
          <div className="mt-[10px]">
            {todo.length ? (
              <CourseList d={d} courses={todo} nav={nav} label={graduated ? "아직 안 들은 과목" : `${openYear}학년 과목`} />
            ) : (
              <p className="text-[13px] leading-[20px] text-ink-3">체험할 수 있는 과목을 모두 들었어요. 재수강해서 성적을 올릴 수도 있어요.</p>
            )}
          </div>
        </section>
        {openYears.length > 0 && (
          <section aria-labelledby="major-more" className="a-up mt-[26px]" style={delay(0.5)}>
            <h2 id="major-more" className="text-[15px] font-bold leading-[22px] text-ink-2">
              다른 과목 더 듣기
            </h2>
            <p className="mt-[2px] text-[12.5px] leading-[19px] text-ink-3">지난 학년에 들었던 과목을 다시 해 보거나, 못 들은 과목을 들어 봐요.</p>
            <div className="no-scrollbar mt-[10px] flex gap-[6px] overflow-x-auto" role="tablist" aria-label="학년 고르기">
              {openYears.map((item) => (
                <button
                  key={item}
                  role="tab"
                  aria-selected={item === year}
                  onClick={() => setPickYear(item)}
                  className={`pressable h-[36px] shrink-0 rounded-full border px-[14px] text-[13px] font-semibold ${
                    item === year ? "border-mint bg-mint text-white" : "border-mint bg-white text-mint-deep"
                  }`}
                >
                  {`${item}학년`}
                </button>
              ))}
            </div>
            <div className="mt-[12px]" role="tabpanel" aria-label={`${year}학년 과목`}>
              <CourseList key={year} d={d} courses={more} nav={nav} label={`${year}학년 과목`} />
            </div>
          </section>
        )}
      </div>
    </Screen>
  );
}
