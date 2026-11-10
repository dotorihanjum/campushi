import React, { useEffect, useMemo, useRef, useState } from "react";
import { LabButton, LabShell, Takeaway, THEMES } from "../LabShell.jsx";
import { BlockBlanks } from "../parts/BlockBlanks.jsx";
import { filled, marksOf, place, scoreOf, shuffledBlocks } from "./logic.js";

const theme = THEMES.paper;

/**
 * 웹/파이선프로그래밍: 설명에 알맞은 파이썬 함수 블록을 빈칸에 끌어다 놓고, 다 맞히면 실제로 실행한 결과를 본다.
 * 틀린 칸은 힌트를 보여 주고 다시 고치게 한다(성적에는 들어가지 않는다). 기록 요약에는 처음 확인했을 때 맞힌 수를 남긴다.
 */
export default function PythonFunctionsLab({ lab, subject, onDone, onQuit }) {
  const { items } = lab;
  const blocks = useMemo(() => shuffledBlocks(items).map((id) => ({ id, label: items.find((item) => item.id === id).block })), [items]);
  const [value, setValue] = useState({});
  const [marks, setMarks] = useState(null);
  const [first, setFirst] = useState(null);
  const [solved, setSolved] = useState(false);
  const body = useRef(null);
  const heading = useRef(null);

  useEffect(() => {
    if (!solved) return;
    if (body.current) body.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [solved]);

  const put = (block, slot) => {
    setValue((old) => place(old, block, slot));
    // 고친 칸의 표시는 지운다(다시 확인할 때까지).
    setMarks((old) => (old ? Object.fromEntries(Object.entries(old).filter(([id]) => id !== slot && old[id] === true)) : old));
  };
  const check = () => {
    const next = marksOf(items, value);
    if (!first) setFirst(scoreOf(items, value));
    setMarks(next);
    if (Object.values(next).every(Boolean)) setSolved(true);
  };
  const wrong = marks ? items.filter((item) => marks[item.id] === false) : [];
  const ready = filled(items, value);

  if (solved) {
    const score = first || scoreOf(items, value);
    return (
      <LabShell
        theme={theme}
        title={`${subject} · 직접 해보기`}
        onQuit={onQuit}
        bodyRef={body}
        footer={
          <LabButton theme={theme} onClick={() => onDone(`파이썬 함수 ${items.length}개 고르기 · 처음 확인 때 ${score.correct}개 맞힘`, score)}>
            기록하러 가기
          </LabButton>
        }
      >
        <p className="text-[12px] font-bold" style={{ color: theme.accent }}>
          다 맞혔어요!
        </p>
        <h2 ref={heading} tabIndex={-1} className="mt-[4px] text-[22px] font-bold leading-[30px] outline-none">
          실제로 실행해 보면
        </h2>
        <p className="mt-[6px] text-[13.5px] leading-[20px]" style={{ color: theme.sub }}>
          파이썬에 이렇게 쓰면 아래 줄의 결과가 나와요. 따옴표가 붙은 건 글자(문자열)라는 표시예요.
        </p>
        <ul className="mt-[12px] grid gap-[8px]">
          {items.map((item) => (
            <li key={item.id} className="rounded-[12px] p-[12px]" style={{ background: "#1b2030" }}>
              <p className="font-mono text-[13px] leading-[19px] text-[#e8ebf2]" style={{ overflowWrap: "anywhere" }}>
                <span className="text-[#7f8aa3]">{">>> "}</span>
                {item.run}
              </p>
              <p className="mt-[2px] font-mono text-[13px] leading-[19px] text-[#8ee6dd]" style={{ overflowWrap: "anywhere" }}>
                {item.out}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-[14px]">
          <Takeaway theme={theme} subject={subject}>
            {lab.takeaway}
          </Takeaway>
        </div>
        <p className="mt-[10px] text-[13px] leading-[20px]" style={{ color: theme.text }}>
          {lab.link}
        </p>
        <p className="mt-[8px] text-[12.5px] leading-[19px]" style={{ color: theme.sub }}>
          {lab.nameTag}
        </p>
      </LabShell>
    );
  }

  return (
    <LabShell
      theme={theme}
      title={`${subject} · 직접 해보기`}
      onQuit={onQuit}
      bodyRef={body}
      footer={
        <LabButton theme={theme} disabled={!ready} onClick={check}>
          {ready ? (marks ? "다시 확인하기" : "확인하기") : `빈칸 ${items.length - Object.keys(value).length}개를 채워요`}
        </LabButton>
      }
    >
      <h2 className="text-[20px] font-bold leading-[28px]">{lab.prompt}</h2>
      <p className="mt-[4px] text-[13px] leading-[20px]" style={{ color: theme.sub }}>
        블록을 빈칸으로 끌어다 놓거나, 블록을 누른 다음 빈칸을 눌러요.
      </p>
      <div className="mt-[16px]">
        <BlockBlanks theme={theme} rows={items} blocks={blocks} value={value} onPlace={put} marks={marks} />
      </div>
      <div role="status" className="mt-[14px] min-h-[20px]">
        {wrong.length > 0 && (
          <div className="rounded-[12px] p-[12px]" style={{ background: theme.bad }}>
            <p className="text-[13px] font-bold" style={{ color: "#a33" }}>{`${wrong.length}개가 달라요. 힌트를 보고 바꿔 봐요.`}</p>
            <ul className="mt-[4px] grid gap-[2px] text-[12.5px] leading-[19px]" style={{ color: theme.text }}>
              {wrong.map((item) => (
                <li key={item.id}>{`#${items.indexOf(item) + 1} ${item.hint}`}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </LabShell>
  );
}
