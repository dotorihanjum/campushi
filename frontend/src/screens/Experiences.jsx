// 체험 탭: 나의 학과 체험(입학한 학과 목록).
import { useEffect, useRef, useState } from "react";
import { yearCharacter } from "../assets.js";
import { delay, Dialog, Screen, Toast } from "../ui.jsx";
import { leaveDepartment, progressOf } from "../model.js";
import { averagePoint } from "../grades.js";
import { Chevron, CreditPill, ProgressBar, TAB_H, TAB_TOP, TabBar, all, download, josa, reportFileName, latestJourney, reportText } from "./shared.jsx";

// 학과 그만두기 확인 문구(manyfast F-MHRPFF·S-JGQDPG, 이슈 #27 원문).
const LEAVE_WARNING = "이 학과의 성적과 기록이 지워지고 되돌릴 수 없어요. 받은 크레딧은 남아요";

export function Experiences({ nav, state, setState }) {
  // 더보기를 펼친 학과 id, 그만두기 확인 창을 연 학과.
  const [menu, setMenu] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(0);
  // 확인 버튼을 연타해도 한 번만 그만두게 한다.
  const leaving = useRef(false);
  const heading = useRef(null);
  const toggles = useRef({});
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  // 더보기 밖을 누르면 닫는다.
  useEffect(() => {
    if (!menu) return;
    const outside = (e) => {
      if (!e.target.closest?.(`[data-dept-menu="${CSS.escape(menu)}"]`)) setMenu(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menu]);
  const menuKeys = (id) => (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    setMenu(null);
    toggles.current[id]?.focus();
  };
  const askLeave = (d) => {
    // 확인 창을 닫으면 포커스가 돌아갈 곳(더보기 버튼). 메뉴 항목은 메뉴를 닫으면 사라진다.
    toggles.current[d.id]?.focus();
    leaving.current = false;
    setMenu(null);
    setConfirm(d);
  };
  const leave = () => {
    if (leaving.current || !confirm) return;
    leaving.current = true;
    const d = confirm;
    setState((s) => leaveDepartment(s, d.id));
    setConfirm(null);
    // 그만둔 학과의 카드는 사라지므로 포커스를 목록 제목으로 옮긴다.
    window.setTimeout(() => heading.current?.focus({ preventScroll: true }), 0);
    setToast(`${josa(d.name, "을", "를")} 그만뒀어요`);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  };
  const departments = all(state);
  // 입학한 순서대로 두고(학과 홈에 들어갈 때마다 순서가 바뀌지 않게), 지금 체험 중인 학과(홈과 같다)에 표시한다.
  const studyingId = state.journeys[state.studying] ? state.studying : latestJourney(state);
  const journeys = Object.keys(state.journeys)
    .map((id) => departments.find((item) => item.id === id && item.school))
    .filter(Boolean)
    .map((d) => ({ d, progress: progressOf(state, d) }));
  const open = (d, to) => {
    setState((s) => ({ ...s, current: d.id }));
    nav.push(to);
  };
  return (
    <Screen
      foot={TAB_TOP}
      veil={false}
      footer={<TabBar active="experience" nav={nav} state={state} />}
      overlay={
        <>
          {confirm && (
            <Dialog
              title={`${josa(confirm.name, "을", "를")} 그만둘까요?`}
              onClose={() => setConfirm(null)}
              actions={
                <>
                  <button className="button ghost" onClick={() => setConfirm(null)}>
                    그대로 두기
                  </button>
                  <button className="button danger" onClick={leave}>
                    학과 그만두기
                  </button>
                </>
              }
            >
              {LEAVE_WARNING}
            </Dialog>
          )}
          <Toast>{toast}</Toast>
        </>
      }
    >
      <CreditPill credits={state.credits || 0} className="absolute right-[20px] top-[55px]" />
      <div
        className="flow no-scrollbar absolute left-0 top-[96px] w-full overflow-y-auto px-[20px] pb-[32px] pt-[4px]"
        style={{ bottom: `calc(${TAB_H}px - var(--bt) * 1px)` }}
      >
        <h1 ref={heading} tabIndex={-1} className="a-up text-[26px] font-bold leading-[34px] text-navy outline-none">
          나의 학과 체험
        </h1>
        <p className="a-up mt-[4px] text-[14px] leading-[22px] text-gray" style={delay(0.06)}>
          {journeys.length ? "학과를 누르면 그 학과의 과목과 진행 상황을 볼 수 있어요." : "학과에 체험 입학하면 여기에서 진행 상황을 볼 수 있어요."}
        </p>
        {journeys.length === 0 ? (
          <div className="a-up mt-[28px] flex flex-col items-center rounded-[24px] border border-dashed border-line bg-chalk px-[20px] pb-[24px] pt-[20px] text-center" style={delay(0.12)}>
            <img src={yearCharacter(1).src} alt="" className="h-[110px] w-[110px] object-contain" />
            <p className="mt-[8px] text-[16px] font-semibold leading-[24px] text-ink-2">아직 체험 중인 학과가 없어요</p>
            <p className="mt-[4px] text-[13.5px] leading-[21px] text-ink-3">캠퍼스 지도에서 핀이 꽂힌 건물을 골라 첫 수업을 들어 봐요.</p>
            <div className="mt-[16px] flex flex-wrap justify-center gap-[8px]">
              <button className="button" onClick={() => nav.reset(["home"], "fade")}>
                캠퍼스 지도 보기
              </button>
              <button className="button ghost" onClick={() => nav.reset([["home", { focus: "departments" }]], "fade")}>
                학과 목록 보기
              </button>
            </div>
          </div>
        ) : (
          <ul className="mt-[20px] grid gap-[14px]">
            {journeys.map(({ d, progress }, i) => {
              const average = averagePoint(progress.taken.map((course) => course.record.grade));
              const studying = d.id === studyingId;
              // 체험 중인(졸업 전) 학과는 흰 카드, 졸업한 학과는 노란 카드.
              const done = progress.graduated;
              return (
                <li key={d.id} className={`a-up overflow-hidden rounded-[20px] border ${done ? "border-cream-line bg-cream" : "border-line bg-white"}`} style={delay(0.12 + Math.min(i, 6) * 0.06)}>
                  <button
                    onClick={() => open(d, "major")}
                    aria-label={`${d.name} 학과 홈으로 가기`}
                    className={`pressable flex w-full items-center gap-[12px] p-[16px] text-left ${done ? "active:bg-cream-2" : "active:bg-chalk"} focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint-deep`}
                  >
                    <img src={yearCharacter(progress.openYear).src} alt="" className="h-[56px] w-[56px] shrink-0 object-contain" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-[6px]">
                        <strong className="min-w-0 truncate text-[17px] font-semibold leading-[24px] text-slate">{d.name}</strong>
                        <span className={`shrink-0 rounded-full px-[9px] py-[1px] text-[12px] font-semibold leading-[18px] ${done ? "bg-sun/40 text-ink" : "bg-mint-soft text-mint-deep"}`}>
                          {done ? "졸업" : `${progress.openYear}학년`}
                        </span>
                        {studying && <span className="shrink-0 text-[12px] font-semibold leading-[18px] text-mint">체험 중</span>}
                      </span>
                      <span className="mt-[2px] block truncate text-[12.5px] leading-[18px] text-gray">
                        {`${d.school} · 이수 ${progress.passedCount}과목${average === null ? "" : ` · 평점 ${average.toFixed(2)}`}`}
                      </span>
                      <span className="mt-[10px] flex items-center gap-[8px]">
                        <span className="block flex-1">
                          <ProgressBar percent={progress.percent} label={`${d.name} 졸업까지 진행률`} />
                        </span>
                        <span className="shrink-0 text-[12px] font-semibold text-mint-deep tabular-nums">{progress.graduated ? "졸업 완료" : `졸업까지 ${progress.percent}%`}</span>
                      </span>
                    </span>
                    <Chevron />
                  </button>
                  <div className={`flex flex-wrap items-center gap-[8px] border-t px-[16px] py-[12px] ${done ? "border-cream-line" : "border-line"}`}>
                    {progress.graduated && (
                      <button className="button ghost" onClick={() => open(d, "graduation")}>
                        졸업 리포트 보기
                      </button>
                    )}
                    {progress.taken.length > 0 && (
                      <button className="button ghost" onClick={() => download(reportFileName(d.school, d.name), reportText(state, d))}>
                        리포트 내려받기
                      </button>
                    )}
                    {/* 카드(학과 홈으로 가는 버튼) 안에 버튼을 넣을 수 없어 카드 아래 줄에 따로 둔다. */}
                    <button
                      ref={(el) => (toggles.current[d.id] = el)}
                      data-dept-menu={d.id}
                      onClick={() => setMenu((m) => (m === d.id ? null : d.id))}
                      onKeyDown={menuKeys(d.id)}
                      aria-label={`${d.name} 더보기`}
                      aria-expanded={menu === d.id}
                      aria-controls={`dept-menu-${d.id}`}
                      className={`pressable ml-auto flex h-[44px] min-w-[44px] items-center justify-center gap-[4px] rounded-[12px] px-[12px] text-[14px] font-semibold text-slate ${done ? "active:bg-cream-2" : "active:bg-chalk"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint-deep`}
                    >
                      더보기
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={`transition-transform ${menu === d.id ? "rotate-180" : ""}`}>
                        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                  {menu === d.id && (
                    <div id={`dept-menu-${d.id}`} data-dept-menu={d.id} onKeyDown={menuKeys(d.id)} className={`border-t px-[16px] py-[12px] ${done ? "border-cream-line" : "border-line"}`}>
                      <button
                        onClick={() => askLeave(d)}
                        className="pressable flex min-h-[44px] w-full items-center rounded-[12px] px-[12px] text-left text-[14px] font-semibold text-[#c62a2f] active:bg-chalk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint-deep"
                      >
                        학과 그만두기
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Screen>
  );
}
