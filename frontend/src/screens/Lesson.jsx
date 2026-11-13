// 수업: 배우기 → 직접 해보기 → 기록 → 결과(성적).
import { Component, Suspense, useEffect, useRef, useState } from "react";
import { yearCharacter } from "../assets.js";
import { delay, FilledButton, Header, Screen } from "../ui.jsx";
import { YEARS, completeCourse, courseKey, gameOf, isRequired, kindOf, labFor, progressOf, recordOf, savePlay, yearOf } from "../model.js";
import { gradeOf, passes, PASS, PASS_GRADE } from "../grades.js";
import { isLessonType } from "../lessonGames.js";
import LessonGame, { useLessonGame } from "../Games.jsx";
import { Rub } from "../Templates.jsx";
import { groupName } from "../groups.js";
import { gameFor } from "../games.js";
import { LAB_SCREENS } from "../labs/components.js";
import { CreditPill, gradeText, josa, useGuard, view } from "./shared.jsx";

const STEPS = ["배우기", "직접 해보기", "기록"];
// 스크롤 영역의 아래 끝을 흐리게 한다(아래 여백 20px 안이라 끝까지 내리면 내용이 가려지지 않는다).
const FADE_END = "linear-gradient(to bottom, #000 calc(100% - 20px), transparent)";

/** 수업 단계 칩. 지나온 단계는 ✓를 붙이고 눌러서 다시 볼 수 있다. */
function StepChips({ step, reached, onGo }) {
  return (
    <ol className="absolute left-[20px] top-[100px] flex gap-[8px]" aria-label="수업 단계">
      {STEPS.map((label, i) => {
        const done = i < reached || (i === reached && i < step);
        const current = i === step;
        return (
          <li key={label}>
            <button
              onClick={() => onGo(i)}
              disabled={current || i > reached}
              aria-current={current ? "step" : undefined}
              className={`pressable flex h-[34px] items-center gap-[4px] rounded-full border px-[13px] text-[13.5px] font-semibold transition-colors ${
                current
                  ? "border-mint bg-mint text-white"
                  : done
                    ? "border-mint bg-mint-soft text-mint-deep"
                    : "border-line bg-white text-mute"
              }`}
            >
              {label}
              {done && !current && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-label="완료">
                  <path d="M1.2 4.6 4 7.3 9.8 1.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** 연한 민트 카드(릿톤 시안의 "배운 내용" 카드). */
function MintCard({ title, children, className = "" }) {
  return (
    <section className={`rounded-[20px] bg-mint-soft px-[18px] py-[16px] ${className}`}>
      <h2 className="text-[15px] font-bold leading-[22px] text-ink-2">{title}</h2>
      <div className="mt-[6px] text-[13.5px] leading-[22px] text-ink-3">{children}</div>
    </section>
  );
}

/** 연습 문제 유형별로 "이 수업에서 해볼 것". */
function quizTask(game) {
  if (game.type === "theory") return "퀴즈 3라운드를 풀어요. 라운드마다 유형이 다르고, 다시 할 때마다 유형과 문제가 바뀌어요.";
  const n = game.items.length;
  if (game.type === "blank") return `문장 ${n}개의 빈칸에 알맞은 말을 골라요.`;
  if (game.type === "ox") return `문장 ${n}개가 맞는지 O, X로 골라요.`;
  if (game.type === "order") return `${n}단계를 올바른 순서로 놓아요.`;
  if (game.type === "match") return `서로 관련된 ${n}쌍의 짝을 맞춰요.`;
  return `${n}개를 알맞은 칸으로 나눠요.`;
}
/** 체험 화면을 불러오지 못하거나(네트워크) 화면에 오류가 나면, 앱 전체가 멈추지 않게 이 자리에서 알린다. */
class LabBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("체험 화면 오류", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert">
        <p className="body-copy">체험을 열지 못했어요. 인터넷 연결을 확인하고 다시 들어와 주세요.</p>
      </div>
    );
  }
}

export function Lesson({ active, nav, route, state, setState }) {
  // 이 화면은 들어올 때의 과목 하나를 다룬다. 열린 학년의 과목만 들을 수 있다.
  const [v] = useState(() => view(state));
  const subject = route?.params?.subject;
  const year = v && typeof subject === "string" ? yearOf(v.d, subject) : null;
  const ok = !!v?.journey && !!year && v.progress.years[year - 1].open;
  const key = ok ? courseKey(v.d.id, subject) : "";
  const game = ok ? gameOf(v.d, subject) : null;
  const isFinal = game === "final";
  // 학과군 전공 실습이면 그 체험 데이터. 아니면 연습 문제 유형(이론 수업)이거나 null(체험 구현 예정).
  const practice = typeof game === "string" && game.startsWith("group:") ? v.d.practice : null;
  // 진짜 수업 체험(labs). 있으면 직접 해보기는 이 체험이고, 연습 문제가 있으면 배우기 단계에서 성적 없이 풀어 본다.
  const lab = ok ? labFor(v.d, subject) : null;
  const typed = !practice && !lab && isLessonType(game);
  const warmup = lab ? gameFor(subject, v.d.lessonGames) : null;
  const quiz = useLessonGame(typed || warmup ? subject : null);
  const [draft, setDraft] = useState(() => (ok ? (state.drafts[key] ?? "") : ""));
  // 체험이나 기록을 이미 시작한 수업은 기록 단계부터 이어간다.
  const [step, setStep] = useState(() => (ok && (state.plays[key] || state.drafts[key]) ? 2 : 0));
  const [reached, setReached] = useState(step);
  const [notice, setNotice] = useState("");
  const [shake, setShake] = useState(0);
  // 수업을 마치고 받은 결과: { grade, percent, best, opened, graduated }.
  const [result, setResult] = useState(null);
  const timer = useRef(0);
  const scroller = useRef(null);
  const heading = useRef(null);
  const moved = useRef(false);
  useGuard(ok, nav, active);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // 단계를 옮기면 맨 위로 올리고 제목에 초점을 둔다(스크린 리더가 새 단계를 읽게).
  useEffect(() => {
    if (!moved.current) return;
    if (scroller.current) scroller.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [step, result]);
  if (!ok) return null;

  const { d, final } = v;
  const kind = isFinal ? "졸업 과제" : kindOf(d, subject);
  const header = <Header title={`${year}학년 · ${subject}`} onBack={nav.back} />;
  const record = recordOf(state, d.id, subject);

  // 체험이 아직 없는 과목(연습 문제가 없어졌거나 형식이 맞지 않는 경우 포함): 구현 예정이라고 알린다. 성적은 남지 않는다.
  if (!isFinal && !practice && !lab && (!typed || quiz.status === "basic"))
    return (
      <Screen foot={700} footer={<FilledButton onClick={nav.back}>과목 목록으로</FilledButton>}>
        {header}
        <div className="flow no-scrollbar absolute bottom-[174px] left-0 top-[100px] w-full overflow-y-auto px-[20px] pt-[18px]">
          <h1 className="a-up text-[26px] font-bold leading-[36px] text-navy">{subject}</h1>
          <p className="a-up mt-[6px] text-[14px] leading-[22px] text-gray" style={delay(0.06)}>
            {`${year}학년 · ${kind} · ${d.name}`}
          </p>
          <MintCard title="체험 구현 예정" className="a-up mt-[22px]">
            <p style={delay(0.1)}>
              {isRequired(d, subject)
                ? "이 과목의 체험은 아직 만들고 있어요. 필수과목이지만 체험이 생기기 전까지는 다음 학년이 열리는 조건에 들어가지 않아요."
                : "이 과목의 체험은 아직 만들고 있어요. 다른 과목을 먼저 들어 보세요."}
            </p>
          </MintCard>
        </div>
      </Screen>
    );

  // 수업을 마친다: 성적을 매겨 남기고(재수강이면 더 좋은 성적), 다음 학년이 열렸는지·졸업했는지 알려준다.
  const finishWith = (base, text) => {
    window.clearTimeout(timer.current);
    const before = progressOf(base, d);
    const after = completeCourse(base, d.id, subject, text);
    if (after === base) return false;
    const got = gradeOf(base.plays[key].score);
    const progress = progressOf(after, d);
    setState(after);
    moved.current = true;
    setResult({
      ...got,
      best: recordOf(after, d.id, subject),
      credits: (after.credits || 0) - (base.credits || 0),
      // 새로 열린 학년들(체험이 있는 필수과목이 없는 학년은 함께 열린다).
      opened: progress.openYear > before.openYear ? YEARS.filter((y) => y > before.openYear && y <= progress.openYear) : null,
      graduated: progress.graduated && !before.graduated,
    });
    return true;
  };
  const again = () => {
    moved.current = true;
    setResult(null);
    setDraft("");
    setStep(0);
    setReached(0);
  };

  if (result) {
    const passed = passes(result.grade);
    return (
      <Screen
        foot={700}
        footer={
          result.graduated ? (
            <FilledButton onClick={() => nav.replace("grades", undefined, "fade")}>성적표와 졸업증명서 받기</FilledButton>
          ) : (
            <>
              <div className="absolute inset-x-[20px] top-[708px] flex h-[36px] items-center justify-end">
                <button onClick={again} className="pressable h-[36px] rounded-full border border-line bg-white px-[14px] text-[13px] font-semibold text-slate">
                  다시 듣기
                </button>
              </div>
              <FilledButton onClick={nav.back}>과목 목록으로</FilledButton>
            </>
          )
        }
      >
        {header}
        <div ref={scroller} className="flow no-scrollbar absolute bottom-[174px] left-0 top-[100px] w-full overflow-y-auto px-[20px] pt-[18px]">
          <h1 ref={heading} tabIndex={-1} className="a-up text-[26px] font-bold leading-[36px] text-navy outline-none">
            {`${subject} 성적`}
          </h1>
          <p className="a-pop mt-[18px] text-[56px] font-extrabold leading-[64px] text-mint-deep" style={delay(0.1)} aria-label={`이번 성적 ${result.grade}`}>
            {result.grade}
          </p>
          <p className="a-up mt-[4px] text-[14px] leading-[22px] text-gray" style={delay(0.16)}>
            {result.grade === PASS ? "끝까지 해서 통과(P)했어요." : lab ? `채점 항목 통과 ${result.percent}%` : `정답률 ${result.percent}%`}
            {result.best && result.best.grade !== result.grade ? ` · 남는 성적은 가장 좋은 ${gradeText(result.best)}이에요` : ""}
          </p>
          {result.credits > 0 && <CreditPill credits={result.credits} className="a-pop mt-[12px] inline-flex" style={delay(0.2)} />}
          {result.credits > 0 && <span className="sr-only">{`크레딧 ${josa(String(result.credits), "을", "를")} 받았어요`}</span>}
          <MintCard
            title={result.graduated ? "졸업을 축하해요!" : result.opened ? `${result.opened.join("·")}학년이 열렸어요!` : passes(result.best?.grade) ? "이수했어요" : "재수강이 필요해요"}
            className="a-up mt-[22px]"
          >
            <p style={delay(0.2)}>
              {result.graduated
                ? `${d.name} 체험 과정을 모두 마쳤어요. 성적표와 졸업증명서를 받아요.`
                : result.opened
                  ? `${result.opened[0] - 1}학년 필수과목을 모두 ${PASS_GRADE} 이상으로 이수했어요. 이제 ${result.opened.at(-1)}학년 과목까지 들을 수 있어요.` +
                    (result.opened.length > 1 ? ` ${result.opened.slice(0, -1).join("·")}학년은 체험이 있는 필수과목이 아직 없어 함께 열렸어요.` : "")
                  : passes(result.best?.grade)
                    ? `${isRequired(d, subject) ? "필수과목으로 인정됐어요." : "선택과목으로 성적표에 남아요."} 다시 들으면 문제가 바뀌고, 가장 좋은 성적이 남아요.`
                    : `${PASS_GRADE} 이상이어야 이수로 인정돼요.${isRequired(d, subject) ? " 필수과목이라 다음 학년이 열리려면 다시 들어야 해요." : ""} 다시 들으면 문제가 바뀌어요.`}
            </p>
          </MintCard>
          {result.opened && (
            <div className="a-pop mt-[16px] flex items-center gap-[12px] rounded-[16px] border border-cream-line bg-cream px-[14px] py-[10px]" style={delay(0.3)}>
              <img src={yearCharacter(result.opened.at(-1)).src} alt={yearCharacter(result.opened.at(-1)).alt} className="h-[64px] w-[72px] object-contain" />
              <p className="whitespace-pre-line text-[13px] font-semibold leading-[19px] text-ink-2">{`${result.opened.at(-1)}학년이 되어\n캐릭터도 자랐어요!`}</p>
            </div>
          )}
          {!passed && passes(result.best?.grade) && (
            <p className="a-up mt-[12px] text-[12.5px] leading-[19px] text-ink-3" style={delay(0.24)}>
              이번 성적은 낮지만 이전에 받은 더 좋은 성적이 남아 있어요.
            </p>
          )}
        </div>
      </Screen>
    );
  }

  // 수업의 종류: 졸업 프로젝트(AI 가르치기 등), 학과군 전공 실습, 진짜 수업 체험, 연습 문제(불러오는 중·오류 포함).
  const mode = isFinal ? "project" : practice ? "practice" : lab ? "lab" : quiz.status === "ready" ? "quiz" : quiz.status;
  const play = state.plays[key]?.game === game ? state.plays[key] : null;
  const played = play?.summary || "";
  const preview = play ? gradeOf(play.score) : null;
  const headline = mode === "project" ? final.name : mode === "practice" ? practice.title : mode === "lab" ? lab.title : mode === "quiz" ? quiz.game.title : subject;
  const warn = (message) => {
    setNotice(message);
    setShake((n) => n + 1);
  };
  const go = (next) => {
    moved.current = true;
    setNotice("");
    setStep(next);
    setReached((r) => Math.max(r, next));
  };
  // 작품 졸업 과제: 칠해서 완성한 뒤 기록 단계로 간다.
  if (isFinal && final.kind === "artwork" && step < 2)
    return (
      <Screen>
        <Header title={d.name} onBack={nav.back} />
        <Rub
          data={final}
          year={year}
          onQuit={nav.back}
          onDone={() => {
            setState((s) => savePlay(s, d.id, subject, "final", `${final.name} 완성`, PASS));
            go(2);
          }}
        />
      </Screen>
    );

  // 입력할 때마다 전체 상태를 저장하지 않도록 잠시 모았다가 저장한다.
  const edit = (text) => {
    setDraft(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState((s) => ({ ...s, drafts: { ...s.drafts, [key]: text } })), 400);
  };
  const finish = () => {
    if (!play) return warn("먼저 직접 해보기를 끝까지 해보세요.");
    if (!finishWith(state, draft)) warn("성적을 남기지 못했어요. 과목 목록에서 다시 들어와 주세요.");
  };
  const written = !!draft.trim();

  let body;
  let action;
  if (step === 0) {
    const task = mode === "project" ? final.task : mode === "practice" ? practice.task : mode === "lab" ? lab.task : mode === "quiz" ? quizTask(quiz.game) : null;
    const learn = (mode === "practice" ? practice : mode === "project" ? final : mode === "lab" ? lab : null)?.learn;
    body = (
      <>
        {mode === "loading" && (
          <p className="a-up mt-[22px] text-[13.5px] text-ink-3" role="status">
            연습 문제를 불러오는 중이에요…
          </p>
        )}
        {mode === "error" && (
          <div className="a-up mt-[22px]" role="alert">
            <p className="body-copy">{quiz.message}</p>
            <button className="button" onClick={quiz.retry}>
              다시 시도
            </button>
          </div>
        )}
        {learn && (
          <MintCard title="알아두기" className="a-up mt-[22px]">
            <p style={delay(0.1)}>{learn}</p>
          </MintCard>
        )}
        {task && (
          <MintCard title="이 수업에서 해볼 것" className={`a-up ${learn ? "mt-[12px]" : "mt-[22px]"}`}>
            <p style={delay(0.12)}>{task}</p>
          </MintCard>
        )}
        {mode === "lab" && (
          <p className="a-up mt-[12px] text-[12px] leading-[18px] text-gray" style={delay(0.14)}>
            {`근거: ${lab.source}`}
          </p>
        )}
        {(mode === "quiz" || mode === "practice" || mode === "project" || mode === "lab") && (
          <p className="a-up mt-[12px] text-[12.5px] leading-[19px] text-ink-3" style={delay(0.16)}>
            {final.kind === "artwork" && isFinal
              ? "끝까지 하면 통과(P)예요."
              : mode === "lab"
                ? `직접 해보기의 과제 채점 결과로 성적을 매겨요. ${PASS_GRADE} 이상이면 이수예요.`
                : `처음 고른 답으로 성적을 매겨요. ${PASS_GRADE} 이상이면 이수예요.`}
            {record ? ` 지금 성적은 ${gradeText(record)}이고, 다시 들으면 가장 좋은 성적이 남아요.` : ""}
          </p>
        )}
      </>
    );
    if (mode === "lab" && warmup)
      body = (
        <>
          {body}
          <div className="a-up mt-[22px]" style={delay(0.2)}>
            <p className="mb-[8px] text-[12.5px] leading-[19px] text-ink-3">수업에서 배우는 개념을 먼저 풀어 봐요. 이 연습은 성적에 들어가지 않아요.</p>
            {quiz.status === "ready" ? (
              <LessonGame game={quiz.game} played="" onComplete={() => {}} />
            ) : quiz.status === "loading" ? (
              <p className="text-[13.5px] text-ink-3" role="status">
                연습 문제를 불러오는 중이에요…
              </p>
            ) : quiz.status === "error" ? (
              <div role="alert">
                <p className="body-copy">{quiz.message}</p>
                <button className="button" onClick={quiz.retry}>
                  다시 시도
                </button>
              </div>
            ) : null}
          </div>
        </>
      );
    action = (
      <FilledButton onClick={() => go(1)} disabled={mode === "loading" || mode === "error"}>
        직접 해보기
      </FilledButton>
    );
  } else if (step === 1 && mode === "lab") {
    // 진짜 수업 체험도 다른 체험처럼 이 단계 안에 들어간다. 화면 코드는 그 과목에 들어갈 때만 불러온다.
    const LabScreen = LAB_SCREENS[lab.id];
    body = (
      <div className="a-up mt-[22px]">
        <LabBoundary>
          <Suspense
            fallback={
              <p className="text-[13.5px] text-ink-3" role="status">
                체험을 불러오는 중이에요…
              </p>
            }
          >
            <LabScreen
              lab={lab}
              subject={subject}
              onComplete={(summary, score) => {
                setNotice("");
                setState((s) => savePlay(s, d.id, subject, game, summary, score));
              }}
            />
          </Suspense>
        </LabBoundary>
      </div>
    );
    action = <FilledButton onClick={() => (play ? go(2) : warn("먼저 끝까지 해보세요."))}>기록하러 가기</FilledButton>;
  } else if (step === 1) {
    body = (
      <div className="a-up mt-[22px]">
        <LessonGame
          game={mode === "project" ? final : mode === "practice" ? practice : quiz.game}
          played={played}
          onComplete={(summary, score) => {
            setNotice("");
            setState((s) => savePlay(s, d.id, subject, game, summary, score ?? PASS));
          }}
        />
      </div>
    );
    action = <FilledButton onClick={() => (play ? go(2) : warn("먼저 끝까지 해보세요."))}>기록하러 가기</FilledButton>;
  } else {
    // 이 수업에서 배운 것(데이터에 없으면 카드를 그리지 않는다).
    const learned = mode === "quiz" ? quiz.game.explanation : mode === "project" ? final.explanation : mode === "lab" ? lab.takeaway : mode === "practice" ? practice.learn : "";
    body = (
      <>
        {learned && (
          <MintCard title="배운 내용" className="a-up mt-[22px]">
            <p>{learned}</p>
          </MintCard>
        )}
        {played && (
          <p className="a-up mt-[14px] text-[13px] leading-[20px] text-mint-deep" style={delay(0.06)}>
            {`오늘 해본 것 · ${played}${preview ? ` · 예상 성적 ${preview.grade}` : ""}`}
          </p>
        )}
        <label className="note-card a-up mt-[16px] block" style={delay(0.12)}>
          <strong>{isFinal ? "체험을 마치며 남기는 생각" : "한 줄 기록"}</strong>
          <textarea
            className="compact"
            rows={2}
            placeholder={isFinal ? "이 전공을 체험하며 알게 된 점이나 달라진 생각을 남겨요." : "직접 해보니 어땠나요? 느낀 점을 한 줄로 남겨요."}
            value={draft}
            maxLength={3000}
            onChange={(e) => edit(e.target.value)}
          />
          <small>{draft.length.toLocaleString()} / 3,000자</small>
        </label>
      </>
    );
    action = <FilledButton onClick={finish}>{written ? "기록 저장하고 성적 받기" : "기록 건너뛰고 성적 받기"}</FilledButton>;
  }

  return (
    <Screen
      foot={740}
      footer={
        <>
          {action}
          <p
            key={shake}
            role="status"
            className={`absolute inset-x-[20px] top-[818px] overflow-hidden text-ellipsis whitespace-nowrap text-center text-[12.5px] leading-[20px] ${notice ? "a-shake text-mint-deep" : "text-gray"}`}
          >
            {notice}
          </p>
        </>
      }
    >
      {header}
      <StepChips step={step} reached={reached} onGo={go} />
      <div
        ref={scroller}
        className="flow no-scrollbar absolute left-0 top-[146px] w-full overflow-y-auto px-[20px] pb-[20px] pt-[18px]"
        // 아래 버튼 바로 위까지 쓴다. 내용이 이어지면 끝이 흐려져 스크롤할 수 있다는 것을 알린다.
        style={{ bottom: "calc(130px - var(--bt) * 1px)", maskImage: FADE_END, WebkitMaskImage: FADE_END }}
      >
        <div key={step}>
          <h1 ref={heading} tabIndex={-1} className="a-up text-[26px] font-bold leading-[36px] text-navy outline-none">
            {headline}
          </h1>
          <p className="a-up mt-[6px] text-[14px] leading-[22px] text-gray" style={delay(0.06)}>
            {isFinal
              ? `${year}학년 · 졸업 과제 · ${subject}`
              : practice
                ? `${year}학년 · ${kind} · ${subject} · ${groupName(d.studyGroup)} 전공 실습`
                : `${year}학년 · ${kind} · ${subject}`}
          </p>
          {body}
          {/* 이전 단계(첫 단계에서는 없음). 위의 단계 칩으로도 돌아갈 수 있어서, 화면이 낮아도 체험 영역을 넓게 쓰도록 내용 끝에 둔다. */}
          {step > 0 && (
            <button onClick={() => go(step - 1)} className="pressable mt-[16px] h-[36px] rounded-full border border-line bg-white px-[14px] text-[13px] font-semibold text-slate">
              ← 이전 단계
            </button>
          )}
        </div>
      </div>
    </Screen>
  );
}
