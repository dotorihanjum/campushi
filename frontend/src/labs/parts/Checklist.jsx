import React from "react";

/**
 * 채점 항목 목록. results가 null이면 아직 검사 중이다. 필수 항목에는 "필수"를 붙인다.
 * 상태는 색만이 아니라 글(통과·아직)로도 알린다.
 */
export function Checklist({ theme, checks, results, label }) {
  return (
    <ul className="grid gap-[6px]" aria-label={label}>
      {checks.map((check) => {
        const ok = results?.[check.id] === true;
        return (
          <li key={check.id} className="flex items-start gap-[8px] text-[13px] leading-[19px]">
            <span
              aria-hidden
              className="mt-[1px] flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold leading-none"
              style={{ width: 17, height: 17, ...(ok ? { background: theme.accent, color: theme.accentText } : { border: `1.5px solid #6f7a96` }) }}
            >
              {ok ? "✓" : ""}
            </span>
            <span className="min-w-0 flex-1" style={{ color: ok ? theme.text : theme.sub }}>
              <span className="sr-only">{results ? (ok ? "통과: " : "아직: ") : "검사 중: "}</span>
              {check.label}
              {check.core && (
                <span className="ml-[6px] text-[10.5px] font-bold" style={{ color: theme.accent }}>
                  필수
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
