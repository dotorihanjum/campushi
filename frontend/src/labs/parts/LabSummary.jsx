import React, { useEffect, useRef } from "react";

/**
 * 실습형 체험의 끝 요약. 마지막 라운드를 끝내면 직접 해보기 단계 안에서 체험 화면 대신 보여 준다(screens/Lesson.jsx).
 * 이 수업을 한 문장으로(크게), 그 아래 고등학교 내용과의 연결과 대학 용어 이름표를 둔다(docs/experience-principles.md 규칙 1·3·4).
 * "기록하러 가기"는 다른 수업 단계처럼 화면 아래 버튼이다.
 *
 * takeaway: { summary, highSchool, terms: [{ name, meaning }] }(labs/index.js의 형식), onRetry: 체험을 처음부터 다시 해 보기.
 */
export function LabSummary({ takeaway, onRetry }) {
  const heading = useRef(null);
  // 체험을 막 끝냈을 때 요약이 보이도록 올리고, 스크린 리더가 요약부터 읽게 초점을 둔다.
  useEffect(() => {
    heading.current?.scrollIntoView?.({ block: "start" });
    heading.current?.focus({ preventScroll: true });
  }, []);
  const { summary, highSchool, terms } = takeaway;
  return (
    <section aria-label="체험 요약" className="scroll-mt-[12px]">
      <p className="a-up text-[13px] font-semibold leading-[20px] text-mint-deep">체험을 끝냈어요</p>
      <h2 ref={heading} tabIndex={-1} className="a-up mt-[6px] text-[21px] font-bold leading-[31px] text-navy outline-none" style={{ overflowWrap: "anywhere" }}>
        {summary}
      </h2>
      <section className="a-up mt-[16px] rounded-[20px] bg-mint-soft px-[18px] py-[16px]">
        <h3 className="text-[15px] font-bold leading-[22px] text-ink-2">고등학교에서 배운 것과 이어져요</h3>
        <p className="mt-[6px] text-[13.5px] leading-[22px] text-ink-3" style={{ overflowWrap: "anywhere" }}>
          {highSchool}
        </p>
      </section>
      <section className="a-up mt-[12px] rounded-[20px] border border-line bg-white px-[18px] py-[16px]">
        <h3 className="text-[15px] font-bold leading-[22px] text-ink-2">대학에서는 이렇게 불러요</h3>
        <ul className="mt-[8px] grid gap-[10px]">
          {terms.map((term) => (
            <li key={term.name}>
              <span className="inline-flex rounded-full bg-mint-soft px-[10px] py-[3px] text-[13px] font-bold leading-[19px] text-mint-deep">{term.name}</span>
              <p className="mt-[4px] text-[13px] leading-[20px] text-ink-3" style={{ overflowWrap: "anywhere" }}>
                {term.meaning}
              </p>
            </li>
          ))}
        </ul>
      </section>
      {onRetry && (
        <button onClick={onRetry} className="pressable a-up mt-[14px] h-[36px] rounded-full border border-line bg-white px-[14px] text-[13px] font-semibold text-slate">
          체험 다시 해보기
        </button>
      )}
    </section>
  );
}
