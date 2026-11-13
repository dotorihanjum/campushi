// 체험 탭: 나의 학과 체험(입학한 학과 목록).
import { yearCharacter } from "../assets.js";
import { delay, Screen } from "../ui.jsx";
import { progressOf } from "../model.js";
import { averagePoint } from "../grades.js";
import { Chevron, CreditPill, ProgressBar, TAB_H, TAB_TOP, TabBar, all, download, latestJourney, reportText } from "./shared.jsx";

export function Experiences({ nav, state, setState }) {
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
    <Screen foot={TAB_TOP} veil={false} footer={<TabBar active="experience" nav={nav} state={state} />}>
      <CreditPill credits={state.credits || 0} className="absolute right-[20px] top-[55px]" />
      <div
        className="flow no-scrollbar absolute left-0 top-[96px] w-full overflow-y-auto px-[20px] pb-[32px] pt-[4px]"
        style={{ bottom: `calc(${TAB_H}px - var(--bt) * 1px)` }}
      >
        <h1 className="a-up text-[26px] font-bold leading-[34px] text-navy">나의 학과 체험</h1>
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
                  {(progress.graduated || progress.taken.length > 0) && (
                    <div className={`flex flex-wrap gap-[8px] border-t px-[16px] py-[12px] ${done ? "border-cream-line" : "border-line"}`}>
                      {progress.graduated && (
                        <button className="button ghost" onClick={() => open(d, "graduation")}>
                          졸업 리포트 보기
                        </button>
                      )}
                      {progress.taken.length > 0 && (
                        <button className="button ghost" onClick={() => download(`${d.school}-${d.name}-체험-리포트.txt`, reportText(state, d))}>
                          리포트 내려받기
                        </button>
                      )}
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
