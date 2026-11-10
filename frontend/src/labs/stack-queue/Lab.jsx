import React, { useEffect, useMemo, useRef, useState } from "react";
import { APP_THEME as theme } from "../theme.js";
import { BlockBlanks } from "../parts/BlockBlanks.jsx";
import { nextOut, run, blocksFor, marksFor } from "./logic.js";

// 꺼내기 줄에서 틀렸을 때 보여 주는 말.
const RETRY = { stack: "스택은 마지막에 넣은 것부터 나와요. 맨 위를 봐요.", queue: "큐는 먼저 넣은 것부터 나와요. 맨 앞(왼쪽 끝)을 봐요." };
const HINT = { stack: "마지막에 들어온 것부터 나오면 스택이에요.", queue: "먼저 들어온 것부터 나오면 큐예요." };

/** 상자 그림: 스택은 아래에서 위로 쌓이고, 큐는 왼쪽(앞)에서 나가고 오른쪽(뒤)으로 들어온다. */
function BoxPicture({ kind, items, out }) {
  const block = (item, i) => (
    <span
      key={`${item}-${i}`}
      className="a-pop flex h-[40px] w-[64px] items-center justify-center rounded-[10px] border-2 border-mint-deep bg-white font-mono text-[17px] font-bold text-ink-2"
    >
      {item}
    </span>
  );
  return (
    <div className="flex items-center gap-[12px] rounded-[16px] bg-cream px-[14px] py-[14px]" aria-label={`지금 ${kind === "stack" ? "스택" : "큐"}에 든 것: ${items.length ? items.join(", ") : "없음"}`}>
      {kind === "stack" ? (
        <div className="shrink-0">
          <p className="text-center text-[11px] font-semibold text-ink-3">↑ 위(넣고 꺼내는 곳)</p>
          <div className="mx-auto mt-[4px] flex min-h-[184px] w-[92px] flex-col-reverse items-center gap-[4px] rounded-b-[14px] border-x-2 border-b-2 border-ink-3/40 px-[12px] pb-[8px] pt-[8px]">
            {items.map(block)}
          </div>
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <div className="flex justify-between text-[11px] font-semibold text-ink-3">
            <span>← 나가는 곳(앞)</span>
            <span>들어오는 곳(뒤) ←</span>
          </div>
          <div className="mt-[6px] flex min-h-[60px] items-center gap-[4px] rounded-[14px] border-y-2 border-ink-3/40 px-[8px]">{items.map(block)}</div>
        </div>
      )}
      <div className="min-w-0 flex-1 text-[12.5px] leading-[19px] text-ink-3" role="status">
        {out ? (
          <>
            <span className="block font-bold text-mint-deep">{`꺼낸 것: ${out}`}</span>
            {kind === "stack" ? "맨 위에서 나왔어요." : "맨 앞에서 나왔어요."}
          </>
        ) : items.length ? (
          `${items.length}개가 들어 있어요.`
        ) : (
          "아직 비어 있어요."
        )}
      </div>
    </div>
  );
}

/** 상자 하나(스택 또는 큐): 규칙을 읽고 명령을 한 줄씩 실행한다. 꺼내기 줄에서는 먼저 무엇이 나올지 고른다. */
function BoxRound({ box, onGuess, onDone }) {
  const [count, setCount] = useState(0);
  const [wrong, setWrong] = useState(null);
  const [said, setSaid] = useState("");
  const tried = useRef(false);
  const { items, out } = run(box.id, box.steps, count);
  const next = box.steps[count];
  const outs = box.steps
    .slice(0, count)
    .map((_, i) => run(box.id, box.steps, i + 1).out)
    .filter((value, i) => box.steps[i].take && value !== null);
  const pick = (item) => {
    const right = item === nextOut(box.id, items);
    if (!tried.current) {
      tried.current = true;
      onGuess(right);
    }
    if (!right) {
      setWrong(item);
      setSaid("");
      return;
    }
    setWrong(null);
    setSaid(`맞아요! ${box.why}`);
    tried.current = false;
    setCount((n) => n + 1);
  };
  return (
    <section aria-label={`${box.name} 해 보기`}>
      <div className="rounded-[20px] bg-mint-soft px-[18px] py-[14px]">
        <h3 className="text-[15px] font-bold leading-[22px] text-ink-2">{`규칙: ${box.name} (${box.picture})`}</h3>
        <p className="mt-[4px] text-[13.5px] leading-[21px] text-ink-3">{box.rule}</p>
      </div>
      <ol className="mt-[12px] grid grid-cols-2 gap-[6px]" aria-label="명령">
        {box.steps.map((step, i) => (
          <li
            key={i}
            aria-current={i === count ? "step" : undefined}
            className={`flex h-[34px] items-center gap-[6px] rounded-[10px] border px-[10px] font-mono text-[13.5px] ${
              i < count ? "border-line bg-white text-gray" : i === count ? "border-mint bg-white font-bold text-ink-2" : "border-line bg-chalk text-mute"
            }`}
          >
            <span className="w-[14px] text-[11px]" aria-hidden>
              {i < count ? "✓" : i === count ? "▶" : ""}
            </span>
            {step.put !== undefined ? `넣기 ${step.put}` : "꺼내기"}
          </li>
        ))}
      </ol>
      <div className="mt-[12px]">
        <BoxPicture kind={box.id} items={items} out={out} />
      </div>
      <div className="mt-[12px]">
        {next?.put !== undefined && (
          <button
            className="button w-full"
            onClick={() => {
              setSaid("");
              setCount((n) => n + 1);
            }}
          >
            {`다음 줄 실행: 넣기 ${next.put}`}
          </button>
        )}
        {next?.take && (
          <div>
            <p className="text-[14px] font-bold leading-[21px] text-navy">꺼내기를 하면 무엇이 나올까요?</p>
            <div className="mt-[8px] flex flex-wrap gap-[8px]" role="group" aria-label="나올 것 고르기">
              {items.map((item) => (
                <button
                  key={item}
                  onClick={() => pick(item)}
                  aria-label={`${item}${wrong === item ? ", 틀림" : ""}`}
                  className={`pressable h-[44px] min-w-[56px] rounded-[12px] border-2 px-[14px] font-mono text-[16px] font-bold ${
                    wrong === item ? "border-[#e06666] bg-[#fdeceb] text-ink-2" : "border-line bg-white text-ink-2"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
        <p role="status" className="mt-[8px] min-h-[20px] text-[13px] leading-[20px]">
          {wrong ? <span className="text-[#a33]">{`${wrong}가 아니에요. ${RETRY[box.id]}`}</span> : <span className="text-mint-deep">{said}</span>}
        </p>
        {!next && (
          <div className="mt-[4px]">
            <p className="text-[13.5px] leading-[21px] text-ink-2">{`꺼낸 순서: ${outs.join(" → ")}`}</p>
            <button className="button mt-[10px] w-full" onClick={onDone}>
              다음으로
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * 자료구조: 스택과 큐에 넣고 꺼내 보고, 생활 속 예시에 어느 쪽이 쓰이는지 고른다.
 * 다른 체험처럼 수업 화면의 직접 해보기 단계 안에 들어간다. 다 끝나면 onComplete로 결과를 남긴다(성적에는 들어가지 않는다).
 */
export default function StackQueueLab({ lab, subject, onComplete }) {
  const { boxes, uses } = lab;
  const [phase, setPhase] = useState(0);
  const [value, setValue] = useState({});
  const [marks, setMarks] = useState(null);
  const [solved, setSolved] = useState(false);
  const firstTries = useRef({ right: 0, total: 0, uses: null });
  const top = useRef(null);
  const blocks = useMemo(() => blocksFor(boxes, uses), [boxes, uses]);

  // 단계가 바뀌면 그 단계의 처음이 보이게 올린다.
  useEffect(() => {
    if (phase > 0) top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [phase, solved]);

  const guess = (right) => {
    firstTries.current.total += 1;
    if (right) firstTries.current.right += 1;
  };
  const put = (block, slot) => {
    setValue((old) => {
      const next = Object.fromEntries(Object.entries(old).filter(([, placed]) => placed !== block));
      if (slot) next[slot] = block;
      return next;
    });
    setMarks((old) => (old ? Object.fromEntries(Object.entries(old).filter(([id, ok]) => id !== slot && ok)) : old));
  };
  const check = () => {
    const next = marksFor(uses, value);
    if (!firstTries.current.uses) firstTries.current.uses = Object.values(next).filter(Boolean).length;
    setMarks(next);
    if (!Object.values(next).every(Boolean)) return;
    setSolved(true);
    const { right, total, uses: usesRight } = firstTries.current;
    const score = { correct: right + usesRight, total: total + uses.length };
    onComplete(`스택·큐에 넣고 꺼내기, 생활 속 예시 ${uses.length}개 · 처음 고른 답 ${score.correct}/${score.total}`, score);
  };
  const wrong = marks ? uses.filter((use) => marks[use.id] === false) : [];
  const filled = uses.every((use) => typeof value[use.id] === "string");

  return (
    <div>
      <p ref={top} className="scroll-mt-[12px] text-[12px] font-bold text-mint-deep">{`${Math.min(phase + 1, 3)} / 3`}</p>
      {phase < boxes.length && (
        <>
          <h2 className="mt-[2px] text-[17px] font-bold leading-[25px] text-navy">{`${boxes[phase].name}에 넣고 꺼내 봐요`}</h2>
          <div className="mt-[12px]">
            <BoxRound key={boxes[phase].id} box={boxes[phase]} onGuess={guess} onDone={() => setPhase((p) => p + 1)} />
          </div>
        </>
      )}
      {phase === boxes.length && (
        <section aria-label="어디에 쓰일까">
          <h2 className="mt-[2px] text-[17px] font-bold leading-[25px] text-navy">어디에 쓰일까요?</h2>
          <p className="mt-[4px] text-[13px] leading-[20px] text-ink-3">괄호 안의 순서를 보고 스택인지 큐인지 블록을 끌어다 놓거나, 블록을 누른 다음 빈칸을 눌러요.</p>
          <div className="mt-[14px]">
            <BlockBlanks theme={theme} rows={uses} blocks={blocks} value={value} onPlace={put} marks={marks} disabled={solved} />
          </div>
          <div role="status" className="mt-[12px]">
            {wrong.length > 0 && (
              <div className="rounded-[14px] px-[14px] py-[12px]" style={{ background: theme.bad }}>
                <p className="text-[13px] font-bold text-[#a33]">{`${wrong.length}개가 달라요. 다시 골라 봐요.`}</p>
                <ul className="mt-[4px] grid gap-[2px] text-[12.5px] leading-[19px] text-ink-2">
                  {[...new Set(wrong.map((use) => use.answer))].map((kind) => (
                    <li key={kind}>{HINT[kind]}</li>
                  ))}
                </ul>
              </div>
            )}
            {solved && <p className="text-[14px] font-bold text-mint-deep">다 맞혔어요!</p>}
          </div>
          {!solved && (
            <button className="button mt-[14px] w-full" onClick={check} disabled={!filled}>
              {filled ? (marks ? "다시 확인하기" : "확인하기") : `빈칸 ${uses.length - Object.keys(value).length}개를 채워요`}
            </button>
          )}
          {solved && (
            <section className="mt-[14px] rounded-[20px] bg-mint-soft px-[18px] py-[16px]">
              <h3 className="text-[15px] font-bold leading-[22px] text-ink-2">{`${subject}에서 실제로 배우는 것`}</h3>
              <p className="mt-[6px] text-[13.5px] leading-[22px] text-ink-3">{lab.takeaway}</p>
              <p className="mt-[8px] text-[13px] leading-[21px] text-ink-3">{lab.link}</p>
              <p className="mt-[8px] text-[12.5px] leading-[19px] text-gray">{lab.nameTag}</p>
            </section>
          )}
        </section>
      )}
    </div>
  );
}
