import React, { useEffect, useMemo, useRef, useState } from "react";
import { APP_THEME as theme } from "../theme.js";
import { BlockBlanks } from "../parts/BlockBlanks.jsx";
import { filled, marksOf, place, scoreOf, shuffledBlocks } from "./logic.js";

/**
 * 웹/파이선프로그래밍: 설명에 알맞은 파이썬 함수 블록을 빈칸에 끌어다 놓고, 다 맞히면 실제로 실행한 결과를 본다.
 * 다른 체험처럼 수업 화면(배우기 · 직접 해보기 · 기록)의 직접 해보기 단계 안에 들어간다. 다 맞히면 onComplete로 결과를 남기고,
 * 아래 "기록하러 가기"로 넘어간다. 틀린 칸은 힌트를 보여 주고 다시 고치게 한다(성적에는 들어가지 않는다).
 */
export default function PythonFunctionsLab({ lab, subject, onComplete }) {
  const { items } = lab;
  const blocks = useMemo(() => shuffledBlocks(items).map((id) => ({ id, label: items.find((item) => item.id === id).block })), [items]);
  const [value, setValue] = useState({});
  const [marks, setMarks] = useState(null);
  const first = useRef(null);
  const [solved, setSolved] = useState(false);
  const done = useRef(null);
  // 다 맞히면 실행 결과가 보이게 내려 준다.
  useEffect(() => {
    if (solved) done.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [solved]);

  const put = (block, slot) => {
    setValue((old) => place(old, block, slot));
    // 고친 칸의 표시는 지운다(다시 확인할 때까지).
    setMarks((old) => (old ? Object.fromEntries(Object.entries(old).filter(([id]) => id !== slot && old[id] === true)) : old));
  };
  const check = () => {
    const next = marksOf(items, value);
    if (!first.current) first.current = scoreOf(items, value);
    setMarks(next);
    if (!Object.values(next).every(Boolean)) return;
    setSolved(true);
    const score = first.current;
    onComplete(`파이썬 함수 ${items.length}개 고르기 · 처음 확인 때 ${score.correct}개 맞힘`, score);
  };
  const wrong = marks ? items.filter((item) => marks[item.id] === false) : [];
  const ready = filled(items, value);

  return (
    <section aria-label={lab.title}>
      <h2 className="text-[17px] font-bold leading-[25px] text-navy">{lab.prompt}</h2>
      <p className="mt-[4px] text-[13px] leading-[20px] text-ink-3">블록을 빈칸으로 끌어다 놓거나, 블록을 누른 다음 빈칸을 눌러요.</p>
      <div className="mt-[14px]">
        <BlockBlanks theme={theme} rows={items} blocks={blocks} value={value} onPlace={put} marks={marks} disabled={solved} />
      </div>
      <div role="status" className="mt-[12px]">
        {wrong.length > 0 && (
          <div className="rounded-[14px] px-[14px] py-[12px]" style={{ background: theme.bad }}>
            <p className="text-[13px] font-bold text-[#a33]">{`${wrong.length}개가 달라요. 힌트를 보고 바꿔 봐요.`}</p>
            <ul className="mt-[4px] grid gap-[2px] text-[12.5px] leading-[19px] text-ink-2">
              {wrong.map((item) => (
                <li key={item.id}>{`#${items.indexOf(item) + 1} ${item.hint}`}</li>
              ))}
            </ul>
          </div>
        )}
        {solved && (
          <p ref={done} className="scroll-mt-[12px] text-[14px] font-bold text-mint-deep">
            다 맞혔어요!
          </p>
        )}
      </div>
      {!solved && (
        <button className="button mt-[14px] w-full" onClick={check} disabled={!ready}>
          {ready ? (marks ? "다시 확인하기" : "확인하기") : `빈칸 ${items.length - Object.keys(value).length}개를 채워요`}
        </button>
      )}
      {solved && (
        <>
          <h3 className="mt-[14px] text-[16px] font-bold leading-[24px] text-navy">실제로 실행해 보면</h3>
          <p className="mt-[2px] text-[12.5px] leading-[19px] text-ink-3">파이썬에 이렇게 쓰면 아래 줄의 결과가 나와요. 따옴표가 붙은 건 글자(문자열)라는 표시예요.</p>
          <ul className="mt-[10px] grid gap-[8px]">
            {items.map((item) => (
              <li key={item.id} className="rounded-[12px] bg-navy px-[12px] py-[10px]">
                <p className="font-mono text-[13px] leading-[19px] text-[#e8ebf2]" style={{ overflowWrap: "anywhere" }}>
                  <span className="text-[#9aa4b8]">{">>> "}</span>
                  {item.run}
                </p>
                <p className="mt-[2px] font-mono text-[13px] leading-[19px] text-[#8ee6dd]" style={{ overflowWrap: "anywhere" }}>
                  {item.out}
                </p>
              </li>
            ))}
          </ul>
          <section className="mt-[14px] rounded-[20px] bg-mint-soft px-[18px] py-[16px]">
            <h3 className="text-[15px] font-bold leading-[22px] text-ink-2">{`${subject}에서 실제로 배우는 것`}</h3>
            <p className="mt-[6px] text-[13.5px] leading-[22px] text-ink-3">{lab.takeaway}</p>
            <p className="mt-[8px] text-[13px] leading-[21px] text-ink-3">{lab.link}</p>
            <p className="mt-[8px] text-[12.5px] leading-[19px] text-gray">{lab.nameTag}</p>
          </section>
        </>
      )}
    </section>
  );
}
