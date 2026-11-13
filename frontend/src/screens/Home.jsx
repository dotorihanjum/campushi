// 홈: 캠퍼스 지도, 캐릭터 말풍선, 학과 목록.
import { useEffect, useRef, useState } from "react";
import { icon, yearCharacter } from "../assets.js";
import { delay, Mask, Screen, T, Dialog, PanView } from "../ui.jsx";
import { progressOf } from "../model.js";
import { CAMPUS, densestSpot, departmentsIn } from "../campus.js";
import CampusMap, { MapCredit, MAP_H, MAP_W } from "../CampusMap.jsx";
import { CreditPill, TAB_H, TAB_TOP, TabBar, all, josa, latestJourney } from "./shared.jsx";

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

// 홈 지도 영역(지도 + 캐릭터 줄)의 높이: 탭바 위까지 채운다. 아래 '학과 둘러보기'는 밀어 올려야 보인다(2026-11-11 사용자 결정).
const HOME_TOP = 164;
// 학과 둘러보기 제목 높이.
const DEPT_HEAD = 44;
// 처음에는 지도 틀에 보이는 크기 안에 건물이 가장 많이 들어오는 곳의 가운데를 보여 준다(2026-11-11 사용자 요청,
// 그림 한가운데는 건물이 적은 숲이라서).
const MAP_FOCUS = (w, h) => densestSpot(w, h);
const HOME_FOLD = `calc((var(--vh) + var(--tt) + var(--bt) - ${TAB_H}) * 1px)`;

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
      h={`calc((var(--vh) + var(--tt) + var(--bt) - ${TAB_H} + ${DEPT_HEAD + Math.max(pickerHeight(list.length), 60) + 16}) * 1px)`}
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
          캐릭터와 말풍선은 세로 가운데로 맞추고, 캐릭터는 지도와 약 14px 떨어진다(줄 위 여백 2 + 가운데 맞춤 12). */}
      <div className="absolute inset-x-0 isolate flex flex-col" style={{ top: HOME_TOP, height: `calc(${HOME_FOLD} - ${HOME_TOP}px)` }}>
        <div className="min-h-[120px] flex-1 px-[16px] pt-[8px]" style={{ maxHeight: MAP_H + 2 + 8 }}>
          {/* 지도 틀은 화면 안에 고정되고(네 모서리가 늘 보인다), 그보다 큰 지도 그림만 틀 안에서 끌어 본다. */}
          <PanView
            width={MAP_W}
            height={MAP_H}
            focus={MAP_FOCUS}
            label={`${CAMPUS.name} 지도. 끌거나 화살표 키로 둘러보고, 두 손가락이나 +·- 키로 확대·축소해요.`}
            overlay={<MapCredit />}
            className="h-full rounded-[24px] border border-[#cfe5c6] bg-[#cdeac2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint-deep"
          >
            <CampusMap departments={list} onOpen={setBuilding} onLocked={locked} />
          </PanView>
        </div>
        <div className="flex h-[100px] shrink-0 items-center gap-[10px] py-[2px] pl-[16px] pr-[18px]" style={{ clipPath: "inset(0 -24px -24px -24px)" }}>
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
