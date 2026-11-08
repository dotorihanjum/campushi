import React, { useState } from "react";
import { OrderTemplate } from "./Templates.jsx";
import {
  BLANK,
  answerOf,
  countCorrect,
  isAnswer,
  questionsOf,
  shuffle,
} from "./lessonGames.js";
import { ROUNDS, roundTitles, theoryRounds } from "./theory.js";

// 미리 만들어 둔 연습 문제의 유형별 화면. 문제(game)는 Games.jsx가 받아서 넘겨준다.
// after: 이론 퀴즈의 라운드로 쓸 때, 다 푼 뒤 "다시 해보기" 대신 보여줄 것(다음 라운드 버튼 등).

function Closing({ children, explanation, onRestart, after }) {
  return (
    <div role="status">
      <p className="body-copy">
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

// 빈칸 채우기, OX, 분류하기: 한 문항씩 보기 하나를 고르고 바로 정답과 해설을 본다.
function Questions({ game, onComplete, intro, unit, stack, renderText, after }) {
  const [questions, setQuestions] = useState(() => questionsOf(game));
  const [picks, setPicks] = useState([]);
  const [index, setIndex] = useState(0);
  const question = questions[index];
  const pick = picks[index];
  const answered = pick !== undefined;

  function choose(number) {
    if (answered) return;
    const next = [...picks, number];
    setPicks(next);
    if (next.length === questions.length) {
      const correct = countCorrect(questions, next);
      onComplete(`${questions.length}${unit} 중 ${correct}개 정답`, { correct, total: questions.length });
    }
  }
  function restart() {
    setQuestions(questionsOf(game));
    setPicks([]);
    setIndex(0);
  }

  if (!question)
    return (
      <Closing explanation={game.explanation} onRestart={restart} after={after}>
        {questions.length}
        {unit} 중 {countCorrect(questions, picks)}개를 맞혔어요.
      </Closing>
    );
  return (
    <>
      <p className="body-copy">{intro}</p>
      <p className="game-progress">
        {index + 1} / {questions.length}
      </p>
      <p className="quiz-text">{renderText(question, answered)}</p>
      <div className={`game-choices ${stack ? "stack" : ""}`} role="group" aria-label="보기">
        {question.options.map((option, number) => (
          <button
            key={option.label}
            aria-disabled={answered}
            aria-pressed={pick === number}
            className={
              !answered ? "" : option.correct ? "is-right" : pick === number ? "is-wrong" : "is-rest"
            }
            onClick={() => choose(number)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="game-feedback" role="status">
        {answered &&
          `${question.options[pick].correct ? "맞아요." : `아쉬워요. 정답은 ${isAnswer(answerOf(question))}.`} ${question.explanation}`}
      </p>
      {answered && (
        <button className="button" onClick={() => setIndex(index + 1)}>
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
        <Closing explanation={game.explanation} onRestart={restart} after={after}>
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
