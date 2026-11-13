// 여러 화면이 같이 쓰는 부품과 도우미(탭바, 과목 카드, 학년 칩, 증명서 틀, 메뉴 줄 등). 한 화면만 쓰는 것은 그 화면 파일에 둔다.
import { useEffect, useState } from "react";
import { icon } from "../assets.js";
import { Mask } from "../ui.jsx";
import { departmentsOf, courseKey, progressOf } from "../model.js";
import { averagePoint } from "../grades.js";
import { lessonTypes } from "../lessonGames.js";
import { templates } from "../experiences.js";

// 학과 목록.
export const all = (state) => departmentsOf(state);

/** 지금 보고 있는 학과와 그 진행 상황(progressOf). 학교가 정해진 학과가 없으면 null. */
export function view(state) {
  const d = all(state).find((item) => item.id === state.current && item.school);
  if (!d) return null;
  return { d, journey: state.journeys[d.id] || null, progress: progressOf(state, d), final: d.final };
}

// 성적 글자: "B+", 정답률이 있으면 "B+ (82%)".
export const gradeText = (record) => (record ? `${record.grade}${Number.isInteger(record.percent) ? ` (${record.percent}%)` : ""}` : "");
/** 가장 최근에 입학한 학과의 id. 입학한 학과가 없으면 null. */
export function latestJourney(state) {
  return Object.keys(state.journeys).reverse().find((id) => all(state).some((item) => item.id === id && item.school)) ?? null;
}

/**
 * 화면에 필요한 학과나 진행 기록이 없으면 홈으로 돌려보낸다(홈은 학과를 고르는 화면을 보여준다).
 * 뒤에 깔려 있는 화면은 다른 학과를 보는 중일 수 있으므로, 맨 위 화면일 때만 확인한다.
 */
export function useGuard(ok, nav, active) {
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
export const josa = (word, withBatchim, without) => word + (hasBatchim(word) ? withBatchim : without);

export function useCountUp(target, ms = 1100, startDelay = 400) {
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
export const TAB_H = TAB_BAR + 28;
export const TAB_TOP = 874 - TAB_H;
const TABS = [
  { id: "home", label: "홈", icon: icon.home, w: 38, h: 38, cx: 52 },
  { id: "experience", label: "체험", icon: icon.major, w: 37, h: 39, cx: 145 },
  { id: "community", label: "커뮤니티", icon: icon.community, w: 39, h: 39, cx: 242.5 },
  { id: "my", label: "마이페이지", icon: icon.my, w: 40, h: 39, cx: 336 },
];

// root: 이 화면이 그 탭의 첫 화면인지. 탭 안쪽 화면(체험 탭의 학과 홈)에서 같은 탭을 누르면 탭의 첫 화면으로 돌아간다.
export function TabBar({ active, nav, state, root = true }) {
  const go = (id) => {
    if (id === active && root) return;
    // 탭은 모두 같은 페이드로 바꾸고, 쌓지 않고 홈 위에 하나만 둔다
    // (탭을 여러 번 오가도 뒤로 가기는 홈으로 돌아간다).
    // 체험: 입학한 학과들의 체험 기록. 학과를 누르면 그 학과 홈(major)으로 들어간다.
    nav.reset(id === "home" ? ["home"] : ["home", id], "fade");
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
export const experienceName = (d, id) =>
  id === "final"
    ? "졸업 과제"
    : id.startsWith("lab:")
      ? "실습 과제"
      : id.startsWith("group:") && d.practice
        ? `전공 실습(${templates[d.practice.template].title})`
        : lessonTypes[id]?.title || "";

/** 과목 카드. 구현 예정·이수(성적, 다시 듣기)·재수강이 필요한 과목·안 들은 과목을 배지로 알린다. */

/** 크레딧 표시(모든 학과 공용). */
export function CreditPill({ credits, className = "", style }) {
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

export function reportText(state, d) {
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

export function download(name, text) {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function Chevron() {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" className="shrink-0 text-faint" aria-hidden>
      <path d="M1.5 1.5 6.5 6.5l-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProgressBar({ percent, label }) {
  return (
    <span className="block h-[8px] overflow-hidden rounded-full bg-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <span className="block h-full rounded-full bg-mint transition-[width] duration-700" style={{ width: `${percent}%` }} />
    </span>
  );
}

export const INPUT = "rounded-[12px] border border-line bg-chalk px-[14px] text-[16px] text-ink-2 outline-none placeholder:text-mute focus:border-mint focus:bg-white";
