import React, { useEffect, useRef, useState } from "react";
import { OrderTemplate } from "./Templates.jsx";
import { pick } from "./korean.js";
import {
  BLANK,
  answerOf,
  choosePick,
  countCorrect,
  firstPicks,
  isAnswer,
  isSettled,
  questionsOf,
  retries,
  shuffle,
} from "./lessonGames.js";

// 문항이 나온 뒤 보기를 고를 수 있기까지의 시간(ms). 사람이 문항을 읽고 고르는 데는 이보다 오래 걸린다.
const SETTLE_MS = 400;

// "은" / "는"(korean.js, #67).
const josa = (label) => pick(label, "은", "는");
import { ROUNDS, roundTitles, theoryRounds } from "./theory.js";

// 미리 만들어 둔 연습 문제의 유형별 화면. 문제(game)는 Games.jsx가 받아서 넘겨준다.
// after: 이론 퀴즈의 라운드로 쓸 때, 다 푼 뒤 "다시 해보기" 대신 보여줄 것(다음 라운드 버튼 등).

// 코드로 초점을 옮기는 글(문항 글, 라운드 결과 문장)의 테두리: 키보드로 왔을 때만(:focus-visible) 민트 2px로 보인다(#61, #65).
const FOCUS_RING = "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-[3px] focus-visible:outline-mint-deep";

// focus: 키보드로 "결과 보기"를 눌러 넘어왔을 때 결과 문장(맞힌 수)에 초점을 둔다(#61). 버튼이 사라져도 초점이 화면 맨 위로
// 떨어지지 않고, 낭독기가 맞힌 수를 읽고, Tab 한 번에 "다음 라운드"로 간다. 초점 테두리는 키보드로 왔을 때만 보인다(:focus-visible).
function Closing({ children, explanation, onRestart, after, focus = false }) {
  const summary = useRef(null);
  useEffect(() => {
    if (focus) summary.current?.focus();
  }, [focus]);
  return (
    <div role="status">
      <p
        ref={summary}
        tabIndex={focus ? -1 : undefined}
        className={`body-copy rounded-[6px] ${FOCUS_RING}`}
      >
        <strong>{children}</strong> {explanation}
      </p>
      {after ?? (
        <button className="text-button" onClick={onRestart}>
          다시 해보기 →
        </button>
      )}
    </div>
  );
}

// 빈칸 채우기, 용어 고르기, 분류하기, OX: 한 문항씩 보기를 고른다.
// 빈칸·용어 고르기·분류하기는 틀리면 정답을 보여 주지 않고 "다시 골라 보세요"와 힌트를 보여 주며, 맞혀야 다음 문제로 간다.
// OX는 한 번 고르면 바로 정답과 해설을 본다(원준 결정 전까지 그대로). 점수는 모두 처음 고른 답으로만 센다(lessonGames.js의 firstPicks).
function Questions({ game, onComplete, intro, unit, stack, renderText, after }) {
  const retry = retries(game.type);
  const [questions, setQuestions] = useState(() => questionsOf(game));
  const [tries, setTries] = useState([]);
  const [index, setIndex] = useState(0);
  // 화면이 다시 그려지기 전에 같은 보기를 연타해도 한 번만 반영하도록, 고른 기록과 결과 보고 여부를 바로 적어 둔다.
  const latest = useRef(tries);
  const reported = useRef(false);
  const prompt = useRef(null);
  const moved = useRef(false);
  // 문항이 화면에 나온 시각. "다음 문제"·"다음 라운드"를 연타·더블클릭한 두 번째 입력이 새 문항의 보기를 고르지 않도록,
  // 문항이 나오고 잠깐(SETTLE_MS)은 보기를 눌러도 고르지 않는다.
  const shownAt = useRef(0);
  const question = questions[index];
  const picked = tries[index] ?? [];
  const settled = !!question && isSettled(question, picked, retry);
  const last = picked.at(-1);
  // 다음 문제로 넘어가면 문항 글에 초점을 둔다("다음 문제" 버튼이 사라져도 Tab 한 번으로 첫 보기에 간다).
  // 첫 보기에 두면 Enter·Space 연타의 두 번째 입력이 그 보기를 골라 버린다(#38 QA).
  useEffect(() => {
    shownAt.current = performance.now();
    if (moved.current) prompt.current?.focus({ preventScroll: true });
  }, [index]);

  function choose(number) {
    if (performance.now() - shownAt.current < SETTLE_MS) return;
    const next = choosePick(questions, latest.current, index, number, retry);
    if (next === latest.current) return;
    latest.current = next;
    setTries(next);
    // 마지막 문항을 끝내면 처음 고른 답으로 채점해 한 번만 알린다.
    if (!reported.current && questions.every((q, i) => isSettled(q, next[i], retry))) {
      reported.current = true;
      const correct = countCorrect(questions, firstPicks(next));
      onComplete(`${questions.length}${unit} 중 ${correct}개 정답`, { correct, total: questions.length });
    }
  }
  function goNext() {
    moved.current = true;
    setIndex(index + 1);
  }
  function restart() {
    setQuestions(questionsOf(game));
    latest.current = [];
    reported.current = false;
    moved.current = false;
    setTries([]);
    setIndex(0);
  }

  if (!question)
    return (
      <Closing explanation={game.explanation} onRestart={restart} after={after} focus={moved.current}>
        {questions.length}
        {unit} 중 {countCorrect(questions, firstPicks(tries))}개를 맞혔어요.
      </Closing>
    );
  // 보기의 모양과 글자 표시: 맞힌 정답(✓ 정답), 틀리게 고른 보기(✕ 아니에요), 끝난 문항의 나머지(흐리게).
  // 색만으로 구분하지 않도록 글자를 붙인다. OX는 예전 모양 그대로 둔다(끝나면 정답 보기를 색으로, 해설 문장에 정답을 적는다).
  const look = (option, number) => {
    if (option.correct && settled) return { className: "is-right", mark: retry ? "✓ 정답" : "" };
    if (picked.includes(number)) return { className: "is-wrong", mark: retry ? "✕ 아니에요" : "" };
    return { className: settled ? "is-rest" : "", mark: "" };
  };
  const firstRight = question.options[picked[0]]?.correct === true;
  let feedback = "";
  if (settled && !retry) feedback = `${question.options[last].correct ? "맞아요." : `아쉬워요. 정답은 ${isAnswer(answerOf(question))}.`} ${question.explanation}`;
  else if (settled) feedback = `맞았어요. ${question.explanation}${firstRight ? "" : " 처음 고른 답으로 점수를 세서, 이 문제는 맞힌 수에 들어가지 않아요."}`;
  return (
    <>
      <p className="body-copy">{intro}</p>
      <p className="game-progress">
        {index + 1} / {questions.length}
      </p>
      <p ref={prompt} tabIndex={-1} className={`quiz-text ${FOCUS_RING}`}>
        {renderText(question, settled)}
      </p>
      <div className={`game-choices ${stack ? "stack" : ""}`} role="group" aria-label="보기">
        {question.options.map((option, number) => {
          const { className, mark } = look(option, number);
          return (
            <button
              key={option.label}
              aria-disabled={settled || picked.includes(number)}
              aria-pressed={picked.includes(number)}
              className={className}
              onClick={() => choose(number)}
            >
              {option.label}
              {mark && <span className={`ml-[8px] whitespace-nowrap text-[12px] font-bold ${className === "is-wrong" ? "text-[#b42318]" : ""}`}>{mark}</span>}
            </button>
          );
        })}
      </div>
      <div className="game-feedback" role="status">
        {feedback && <p>{feedback.trim()}</p>}
        {retry && !settled && picked.length > 0 && (
          <div className="mt-[2px] rounded-[12px] border border-[#e5484d] bg-[#fff1f1] px-[12px] py-[10px] text-[#8f1d1d]">
            <p>
              <strong>다시 골라 보세요.</strong> {`고른 ‘${question.options[last].label}’${josa(question.options[last].label)} 답이 아니에요.`}
            </p>
            {question.hint && <p>{`힌트: ${question.hint}`}</p>}
          </div>
        )}
      </div>
      {settled && (
        <button className="button" onClick={goNext}>
          {index === questions.length - 1 ? "결과 보기" : "다음 문제"}
        </button>
      )}
    </>
  );
}

function Blank(props) {
  return (
    <Questions
      {...props}
      unit="문제"
      stack
      intro="빈칸에 들어갈 말을 골라요."
      renderText={(question, answered) => {
        const [before, after] = question.text.split(BLANK);
        return (
          <>
            {before}
            <span className={`quiz-blank ${answered ? "filled" : ""}`}>
              {answered ? answerOf(question) : <span className="sr-only">빈칸</span>}
            </span>
            {after}
          </>
        );
      }}
    />
  );
}

// 이론 퀴즈의 용어 고르기: 뜻을 보고 알맞은 용어를 고른다.
function Pick(props) {
  return (
    <Questions
      {...props}
      unit="문제"
      stack
      intro="설명에 맞는 용어를 골라요."
      renderText={(question) => question.text}
    />
  );
}

function Ox(props) {
  return (
    <Questions
      {...props}
      unit="문제"
      intro="문장이 맞으면 O, 틀리면 X를 골라요."
      renderText={(question) => question.text}
    />
  );
}

function Sort(props) {
  return (
    <Questions
      {...props}
      unit="개"
      stack
      intro={props.game.prompt}
      renderText={(question) => question.text}
    />
  );
}

// 순서 맞추기는 체험 틀 B(자리 옮기기)를 그대로 쓴다.
function Order({ game, onComplete, after }) {
  return (
    <OrderTemplate
      data={{ swap: "move", prompt: game.prompt, items: game.items.map((item) => item.text), explanation: game.explanation }}
      onComplete={onComplete}
      after={after}
    />
  );
}

function Match({ game, onComplete, after }) {
  const size = game.items.length;
  const [rights, setRights] = useState(() => shuffle(game.items.map((_, i) => i)));
  const [selected, setSelected] = useState(null); // { side: "left" | "right", item }
  const [matched, setMatched] = useState([]);
  const [misses, setMisses] = useState(0);
  const [feedback, setFeedback] = useState("");
  const done = matched.length === size;

  function tap(side, item) {
    if (matched.includes(item)) return;
    if (!selected || selected.side === side) {
      setSelected(selected?.side === side && selected.item === item ? null : { side, item });
      setFeedback("");
      return;
    }
    setSelected(null);
    if (selected.item !== item) {
      setMisses(misses + 1);
      setFeedback("짝이 아니에요. 다시 골라보세요.");
      return;
    }
    const next = [...matched, item];
    setMatched(next);
    setFeedback(`맞아요. ${game.items[item].left} — ${game.items[item].right}`);
    // 점수: 짝마다 1점, 틀린 시도마다 1점씩 뺀다(0점 아래로는 내려가지 않는다).
    if (next.length === size) onComplete(`${size}쌍 짝 맞추기 · 틀린 시도 ${misses}번`, { correct: Math.max(0, size - misses), total: size });
  }
  function restart() {
    setRights(shuffle(game.items.map((_, i) => i)));
    setSelected(null);
    setMatched([]);
    setMisses(0);
    setFeedback("");
  }
  const card = (side, item) => (
    <button
      key={item}
      aria-pressed={selected?.side === side && selected.item === item}
      aria-disabled={matched.includes(item)}
      className={matched.includes(item) ? "is-right" : ""}
      onClick={() => tap(side, item)}
    >
      {game.items[item][side]}
    </button>
  );

  if (done)
    return (
      <>
        <dl className="match-pairs">
          {game.items.map((item) => (
            <div key={item.left}>
              <dt>{item.left}</dt>
              <dd>{item.right}</dd>
            </div>
          ))}
        </dl>
        {/* 마지막 짝을 맞히면 고른 카드가 사라지므로 결과 문장에 초점을 둔다(#65, #61과 같은 방식). */}
        <Closing explanation={game.explanation} onRestart={restart} after={after} focus>
          {size}쌍을 모두 맞췄어요. 틀린 시도는 {misses}번이에요.
        </Closing>
      </>
    );
  return (
    <>
      <p className="body-copy">{game.prompt} 왼쪽과 오른쪽에서 하나씩 골라요.</p>
      <div className="match-board">
        <div role="group" aria-label="왼쪽 항목">
          {game.items.map((_, item) => card("left", item))}
        </div>
        <div role="group" aria-label="오른쪽 항목">
          {rights.map((item) => card("right", item))}
        </div>
      </div>
      <p className="game-feedback" role="status">
        {feedback}
      </p>
      <p className="game-progress">
        {matched.length} / {size}쌍
      </p>
    </>
  );
}

const roundComponents = { match: Match, pick: Pick, ox: Ox, sort: Sort, order: Order };

// 이론 퀴즈: 문제 은행에서 뽑은 라운드 3개를 차례로 푼다. 다 풀면 다른 유형·문항으로 다시 풀 수 있다.
function Theory({ game, onComplete }) {
  const [play, setPlay] = useState(() => ({ id: 0, rounds: theoryRounds(game) }));
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState([]); // 라운드마다 { summary, score }
  const round = play.rounds[index];
  const Round = roundComponents[round.type];
  const last = index === play.rounds.length - 1;

  // 점수: 세 라운드의 맞힌 수와 문항 수를 더한다.
  function complete(summary, score) {
    if (results.length > index) return;
    const next = [...results, { summary, score }];
    setResults(next);
    if (next.length === play.rounds.length) {
      const correct = next.reduce((sum, item) => sum + item.score.correct, 0);
      const total = next.reduce((sum, item) => sum + item.score.total, 0);
      onComplete(`${ROUNDS}라운드 · ${total}문항 중 ${correct}개 · ${next.map((item) => item.summary).join(" / ")}`.slice(0, 200), { correct, total });
    }
  }
  function again() {
    setPlay((current) => ({ id: current.id + 1, rounds: theoryRounds(game, Math.random, current.rounds.map((r) => r.type)) }));
    setIndex(0);
    setResults([]);
  }
  const after =
    results.length <= index ? null : last ? (
      <div className="theory-end">
        <p className="body-copy">
          <strong>{ROUNDS}라운드를 모두 마쳤어요.</strong> 다시 풀면 다른 유형과 문제가 나와요.
        </p>
        <button className="button" onClick={again}>
          다른 문제로 다시 풀기
        </button>
      </div>
    ) : (
      <button className="button" onClick={() => setIndex(index + 1)}>
        다음 라운드 · {roundTitles[play.rounds[index + 1].type]}
      </button>
    );

  return (
    <>
      <ol className="round-steps" aria-label="라운드">
        {play.rounds.map((item, i) => (
          <li
            key={`${play.id}-${i}`}
            aria-current={i === index ? "step" : undefined}
            className={i < results.length ? "is-done" : i === index ? "is-now" : ""}
          >
            {i + 1}. {roundTitles[item.type]}
          </li>
        ))}
      </ol>
      <Round key={`${play.id}-${index}`} game={round} onComplete={complete} after={after} />
    </>
  );
}

// 유형을 추가하려면 lessonGames.js의 lessonTypes와 같은 이름으로 여기에 화면을 등록한다.
export const typedComponents = { blank: Blank, ox: Ox, order: Order, match: Match, sort: Sort, theory: Theory };
