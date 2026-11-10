import React from "react";

// 진짜 수업 체험의 공통 틀. 화면 전체를 그 수업의 공간(실습실·작업실·코딩 화면 등)으로 바꾸고, 위에는 나가기와 단계,
// 가운데는 과목 모듈의 내용(스크롤), 아래에는 다음 행동 버튼을 둔다. 색은 과목 모듈이 theme으로 정한다.
//
// theme: { bg, panel, line, text, sub, accent, accentText }
export const THEMES = {
  // 코드 편집기처럼 어두운 화면(웹·프로그래밍 실습).
  code: { bg: "#1b2030", panel: "#242b3d", line: "#343d55", text: "#e8ebf2", sub: "#a9b1c4", accent: "#27d8cd", accentText: "#06302d" },
};

/** 체험 화면 틀. steps: 단계 이름들, step: 지금 단계 번호(-1이면 단계 표시 없음). */
export function LabShell({ theme, title, steps = [], step = -1, onQuit, footer, children, bodyRef }) {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: theme.bg, color: theme.text }}>
      <header
        className="flex shrink-0 items-center gap-[10px] px-[12px] pb-[8px]"
        style={{ paddingTop: "calc(max(12px, (48 - var(--tt)) * 1px))", borderBottom: `1px solid ${theme.line}` }}
      >
        <button
          onClick={onQuit}
          className="pressable flex h-[36px] shrink-0 items-center gap-[4px] rounded-full px-[10px] text-[13px] font-semibold"
          style={{ color: theme.sub, border: `1px solid ${theme.line}` }}
        >
          <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden>
            <path d="M6.5 1.5 2 6l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          나가기
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[14px] font-semibold">{title}</h1>
        {step >= 0 && steps.length > 0 && (
          <ol className="flex shrink-0 items-center gap-[4px]" aria-label={`단계 ${steps.length}개 중 ${step + 1}번째: ${steps[step]}`}>
            {steps.map((label, i) => (
              <li
                key={label}
                aria-hidden
                className="h-[6px] rounded-full transition-all"
                style={{ width: i === step ? 18 : 6, background: i <= step ? theme.accent : theme.line }}
              />
            ))}
          </ol>
        )}
      </header>
      <div ref={bodyRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-[14px] pb-[16px] pt-[12px]">
        {children}
      </div>
      {footer && (
        <footer
          className="shrink-0 px-[14px] pt-[10px]"
          style={{ paddingBottom: "calc(max(12px, (30 - var(--bt)) * 1px))", borderTop: `1px solid ${theme.line}` }}
        >
          {footer}
        </footer>
      )}
    </div>
  );
}

/** 셸 아래의 큰 버튼. */
export function LabButton({ theme, children, onClick, disabled, ghost }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="pressable flex h-[52px] w-full items-center justify-center rounded-[14px] px-[16px] text-[16px] font-bold disabled:cursor-not-allowed disabled:opacity-45"
      style={ghost ? { color: theme.text, border: `1px solid ${theme.line}` } : { background: theme.accent, color: theme.accentText }}
    >
      <span className="truncate">{children}</span>
    </button>
  );
}

/** 끝 화면에 두는 "이 수업에서 실제로 배우는 것" 한 줄. */
export function Takeaway({ theme, subject, children }) {
  return (
    <section className="rounded-[14px] p-[14px]" style={{ background: theme.panel, border: `1px solid ${theme.accent}` }}>
      <h2 className="text-[12px] font-bold" style={{ color: theme.accent }}>
        {`${subject}에서 실제로 배우는 것`}
      </h2>
      <p className="mt-[6px] text-[14px] leading-[21px]">{children}</p>
    </section>
  );
}
