// 커뮤니티(미리보기)의 부품과 덮는 화면들: 질문 줄·선배 줄, 전체 글, 검색, 질문 상세, 질문 쓰기, 선배 프로필, 쪽지함, 쪽지 대화.
// 피그마 "릿톤" 파일의 커뮤니티 리디자인 페이지(node 294:350)를 따른다.
import { useEffect, useRef, useState } from "react";
import { icon, yearCharacter } from "../assets.js";
import { Dialog, Mask } from "../ui.jsx";
import { BODY_MAX, COMMENT_MAX, MESSAGE_MAX, TITLE_MAX, answeredBy, checkComment, checkMessage, checkPost, hasMentorAnswer, lastMessage, sortThreads, timeAgo } from "../community.js";
import { Chevron, INPUT } from "./shared.jsx";

/* ---------- 아이콘(선 아이콘, 2px) ---------- */
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
export const SearchIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...stroke}>
    <circle cx="11" cy="11" r="7.5" />
    <path d="m20.5 20.5-4-4" />
  </svg>
);
export const MailIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...stroke} strokeWidth={1.7}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);
export const PencilIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden {...stroke} strokeWidth={2.2}>
    <path d="M12 20h9" />
    <path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6a2 2 0 0 1-.9.5l-2.9.8.8-2.9a2 2 0 0 1 .5-.8z" />
  </svg>
);
const BubbleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden {...stroke}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </svg>
);
const SendIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden {...stroke}>
    <path d="M14.5 21.7a.5.5 0 0 0 .9 0l6.5-19a.5.5 0 0 0-.6-.6l-19 6.5a.5.5 0 0 0 0 .9l7.9 3.2a2 2 0 0 1 1.1 1.1z" />
    <path d="m21.9 2.1-11 11" />
  </svg>
);

/* ---------- 작은 부품 ---------- */

/** 학년 캐릭터 동그라미(재학생 얼굴 대신). */
export function Avatar({ year, size = 52 }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-mint-soft" style={{ width: size, height: size }}>
      <img src={yearCharacter(year).src} alt="" style={{ width: size * 0.82, height: size * 0.82 }} className="object-contain" />
    </span>
  );
}

/** "재학생" 이름표. */
export function MentorTag() {
  return <span className="inline-flex h-[18px] shrink-0 items-center rounded-full border border-mint/60 px-[7px] text-[10.5px] font-medium text-mint-deep">재학생</span>;
}

export function SectionTitle({ children, right, id, className = "" }) {
  return (
    <div className={`flex items-center justify-between gap-[8px] ${className}`}>
      <h2 id={id} className="text-[15px] font-bold leading-[22px] text-ink-2">
        {children}
      </h2>
      {right && <span className="shrink-0 text-[12px] font-medium text-ink-3">{right}</span>}
    </div>
  );
}

/** "전체 글 보기 ›"처럼 목록 끝에서 더 보러 가는 버튼. */
export function MoreButton({ children, onClick, className = "" }) {
  return (
    <button onClick={onClick} className={`pressable flex h-[48px] w-full items-center justify-center gap-[6px] rounded-[10px] border border-line bg-white text-[14px] font-medium text-slate active:bg-chalk ${className}`}>
      {children}
      <Chevron />
    </button>
  );
}

/** 질문하기 버튼(목록 오른쪽 아래에 떠 있다). */
export function WriteButton({ onClick, disabled, style, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={`pressable absolute right-[20px] z-10 flex h-[48px] items-center gap-[6px] rounded-[10px] bg-mint pl-[16px] pr-[18px] text-[15px] font-bold text-white shadow-[0_4px_12px_rgba(8,127,119,0.18)] active:brightness-95 disabled:opacity-40 ${className}`}
    >
      <PencilIcon />
      질문하기
    </button>
  );
}

/** 학과 필터 칩(가로로 밀어 본다). 고른 칩이 밖에 있으면 보이게 민다. */
export function FilterChips({ chips, value, onChange, className = "" }) {
  const row = useRef(null);
  useEffect(() => {
    row.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);
  return (
    <div ref={row} className={`no-scrollbar flex gap-[8px] overflow-x-auto scroll-px-[20px] px-[20px] ${className}`} role="group" aria-label="학과 필터">
      {chips.map((c) => (
        <button
          key={c.id}
          aria-pressed={value === c.id}
          onClick={() => onChange(c.id)}
          className={`pressable h-[34px] shrink-0 whitespace-nowrap rounded-full border px-[14px] text-[13px] ${value === c.id ? "border-mint bg-mint font-bold text-white" : "border-slate/35 bg-[#f6f7f4] font-medium text-slate"}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function Meta({ q }) {
  return (
    <span className="mt-[10px] flex items-center justify-between gap-[8px] text-[12px] leading-[17px]">
      <span className="min-w-0 truncate text-gray">{`${q.author} · ${timeAgo(q.at)}`}</span>
      <span className="flex shrink-0 items-center gap-[10px]">
        {hasMentorAnswer(q) && <span className="font-medium text-mint-deep">재학생 답변</span>}
        <span className="flex items-center gap-[4px] text-gray" aria-label={`댓글 ${q.comments.length}개`}>
          <BubbleIcon />
          <span aria-hidden>{q.comments.length}</span>
        </span>
      </span>
    </span>
  );
}

/** 질문 한 줄(카드 없이 아래 구분선으로 나눈다). */
export function QuestionRow({ q, deptName, onOpen }) {
  return (
    <li className="border-b border-track">
      <button onClick={onOpen} className="pressable block w-full py-[18px] text-left active:bg-chalk">
        <span className="block text-[12px] font-medium leading-[17px] text-mint-deep">{deptName}</span>
        <span className="report-text mt-[6px] text-[16px] font-bold leading-[23px] text-navy" style={{ WebkitLineClamp: 2 }}>
          {q.title}
        </span>
        <span className="report-text mt-[6px] text-[14px] leading-[21px] text-ink-3" style={{ WebkitLineClamp: 2 }}>
          {q.body}
        </span>
        <Meta q={q} />
      </button>
    </li>
  );
}

/** 이번 주 댓글이 많은 질문(노란 안내 카드 — 기존 화면의 하이라이트 카드와 같은 모양). */
export function FeaturedQuestion({ q, deptName, onOpen, className = "" }) {
  return (
    <button onClick={onOpen} className={`pressable block w-full rounded-[16px] border border-cream-line bg-cream px-[18px] py-[18px] text-left active:bg-cream-2 ${className}`}>
      <span className="flex items-center justify-between gap-[8px] text-[12px] leading-[17px]">
        <span className="font-bold text-slate">이번 주 댓글이 많은 질문</span>
        <span className="truncate font-medium text-mint-deep">{deptName}</span>
      </span>
      <span className="report-text mt-[6px] text-[17px] font-bold leading-[25px] text-navy" style={{ WebkitLineClamp: 2 }}>
        {q.title}
      </span>
      <span className="report-text mt-[6px] text-[14px] leading-[21px] text-ink-3" style={{ WebkitLineClamp: 2 }}>
        {q.body}
      </span>
      <Meta q={q} />
    </button>
  );
}

/** 재학생 한 줄: 누르면 프로필, 오른쪽 아래 "쪽지"는 바로 쪽지 쓰기. */
export function MentorRow({ m, deptLabel, answers, onOpen, onMessage }) {
  return (
    <li className="relative border-b border-track">
      <button onClick={onOpen} className="pressable flex w-full gap-[14px] py-[20px] text-left active:bg-chalk" aria-label={`${m.nickname}, ${deptLabel} ${m.year}학년 재학생 프로필`}>
        <Avatar year={m.year} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-[6px]">
            <span className="truncate text-[15px] font-bold leading-[21px] text-navy">{m.nickname}</span>
            <MentorTag />
          </span>
          <span className="mt-[4px] block truncate text-[12px] font-medium leading-[17px] text-mint-deep">{`${deptLabel} · ${m.year}학년`}</span>
          <span className="report-text mt-[4px] text-[13px] leading-[19px] text-ink-3" style={{ WebkitLineClamp: 2 }}>
            {m.intro}
          </span>
          <span className="mt-[10px] flex h-[32px] items-center gap-[4px] text-[12px] text-gray">
            <BubbleIcon />
            {answers ? `답변 ${answers}개` : "아직 답변이 없어요"}
          </span>
        </span>
      </button>
      <button onClick={onMessage} className="pressable absolute bottom-[20px] right-0 flex h-[32px] items-center rounded-[8px] border border-mint bg-white px-[12px] text-[12px] font-bold text-mint-deep active:bg-mint-soft">
        쪽지
        <span className="sr-only">{` 보내기: ${m.nickname}`}</span>
      </button>
    </li>
  );
}

/* ---------- 덮는 화면의 틀 ---------- */

/**
 * 커뮤니티 안에서 위로 쌓이는 화면. 위쪽 줄(뒤로·제목·오른쪽 버튼), 가운데 스크롤, 아래 고정 영역.
 * 열리면 제목에 초점을 두고, Esc를 누르면 닫는다. 아래에 깔린 화면은 inert라 초점이 넘어가지 않는다.
 */
export function View({ title, onBack, right, footer, children, inert, head, bodyRef, floating }) {
  const heading = useRef(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  // Esc는 맨 위 화면만 닫는다. 초점이 사라진 뒤(버튼이 없어진 뒤 등)에도 닫히게 창 전체에서 듣는다.
  // 확인 창은 자기 Esc를 막고(stopPropagation), 확인 창이 떠 있는 동안 이 화면은 inert라 듣지 않는다.
  const back = useRef(onBack);
  back.current = onBack;
  useEffect(() => {
    if (inert) return undefined;
    const onKey = (e) => e.key === "Escape" && !e.defaultPrevented && back.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inert]);
  return (
    // 바탕은 바로 하얗게 덮고 안의 내용만 서서히 나타나게 해서, 아래 화면이 비쳐 겹쳐 보이지 않게 한다.
    <section className="absolute inset-0 z-30 bg-white" inert={inert} aria-label={title}>
      <div className="a-fade flex h-full flex-col">
        <div className="relative flex shrink-0 items-center px-[14px] pb-[6px]" style={{ paddingTop: "calc((48 - var(--tt)) * 1px)" }}>
          <button type="button" aria-label="뒤로" onClick={onBack} className="pressable flex h-[40px] w-[40px] shrink-0 items-center justify-center">
            <Mask src={icon.back} w={16} h={24} color="#949494" />
          </button>
          {head || (
            <h1 ref={heading} tabIndex={-1} className="min-w-0 flex-1 truncate px-[4px] text-center text-[14px] font-medium leading-[22px] text-mint outline-none">
              {title}
            </h1>
          )}
          <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center">{right}</span>
        </div>
        <div ref={bodyRef} className="flow no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 bg-white" style={{ paddingBottom: "calc((36 - var(--bt)) * 1px)" }}>
            {footer}
          </div>
        )}
        {floating}
      </div>
    </section>
  );
}

/* ---------- 전체 글 ---------- */

export function AllQuestions({ questions, chips, filter, onFilter, deptName, onOpen, onWrite, canWrite, onBack, inert, empty }) {
  return (
    <View
      title="전체 글"
      onBack={onBack}
      inert={inert}
      floating={<WriteButton onClick={onWrite} disabled={!canWrite} style={{ bottom: "calc((52 - var(--bt)) * 1px)" }} />}
    >
      <FilterChips chips={chips} value={filter} onChange={onFilter} className="pt-[8px]" />
      <div className="px-[20px] pb-[120px] pt-[20px]">
        <SectionTitle right="최신순">{`전체 글 ${questions.length}개`}</SectionTitle>
        {questions.length === 0 ? (
          <p className="mt-[24px] text-center text-[14px] leading-[21px] text-ink-3" role="status">
            {empty}
          </p>
        ) : (
          <ul className="mt-[4px]">
            {questions.map((q) => (
              <QuestionRow key={q.id} q={q} deptName={deptName(q.dept)} onOpen={() => onOpen(q.id)} />
            ))}
          </ul>
        )}
      </div>
    </View>
  );
}

/* ---------- 검색 ---------- */

export function Search({ query, onQuery, result, mentorsAll, questions, deptName, deptLabel, onOpenQuestion, onOpenMentor, onMessage, onBack, inert }) {
  const input = useRef(null);
  useEffect(() => input.current?.focus({ preventScroll: true }), []);
  const typed = query.trim().length > 0;
  const mentors = typed ? result.mentors : mentorsAll;
  const answers = (m) => answeredBy(questions, m.id).length;
  const head = (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="flex min-w-0 flex-1 items-center gap-[8px] rounded-[10px] border border-mint bg-white px-[14px]" style={{ height: 46 }}>
      <span className="text-gray">
        <SearchIcon />
      </span>
      <label htmlFor="community-search" className="sr-only">
        커뮤니티 검색
      </label>
      <input
        ref={input}
        id="community-search"
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="궁금한 학과, 선배, 질문 검색"
        autoComplete="off"
        enterKeyHint="search"
        maxLength={40}
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink-2 outline-none placeholder:text-mute [&::-webkit-search-cancel-button]:hidden"
      />
      {typed && (
        <button type="button" aria-label="검색어 지우기" onClick={() => onQuery("")} className="pressable -mr-[6px] flex h-[32px] w-[32px] items-center justify-center text-faint">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="10" fill="currentColor" />
            <path d="m15 9-6 6M9 9l6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </form>
  );
  const nothing = typed && !result.mentors.length && !result.questions.length;
  return (
    <View title="검색" onBack={onBack} inert={inert} head={head}>
      <div className="px-[20px] pb-[40px] pt-[12px]">
        {nothing ? (
          <p className="mt-[40px] text-center text-[14px] leading-[22px] text-ink-3" role="status">
            {`'${query.trim()}'에 맞는 선배나 질문이 없어요.`}
            <br />
            학과 이름이나 다른 낱말로 찾아보세요.
          </p>
        ) : (
          <>
            <p className="sr-only" role="status">
              {typed ? `선배 ${result.mentors.length}명, 질문 ${result.questions.length}개를 찾았어요.` : ""}
            </p>
            {mentors.length > 0 && (
              <section aria-labelledby="search-mentors">
                <SectionTitle id="search-mentors">{typed ? `선배 ${mentors.length}명` : `재학생 선배 ${mentors.length}명`}</SectionTitle>
                {!typed && <p className="mt-[4px] text-[13px] leading-[19px] text-ink-3">학과 이름이나 궁금한 주제로 찾아볼 수도 있어요.</p>}
                <ul className="mt-[4px]">
                  {mentors.map((m) => (
                    <MentorRow key={m.id} m={m} deptLabel={deptLabel(m.dept)} answers={answers(m)} onOpen={() => onOpenMentor(m.id)} onMessage={() => onMessage(m.id)} />
                  ))}
                </ul>
              </section>
            )}
            {typed && result.questions.length > 0 && (
              <section aria-labelledby="search-questions" className="mt-[28px]">
                <SectionTitle id="search-questions">{`질문 ${result.questions.length}개`}</SectionTitle>
                <ul className="mt-[4px]">
                  {result.questions.map((q) => (
                    <QuestionRow key={q.id} q={q} deptName={deptName(q.dept)} onOpen={() => onOpenQuestion(q.id)} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </View>
  );
}

/* ---------- 질문 상세 ---------- */

/** 재학생이 단 댓글(청록 카드, 위에 먼저 보인다). */
function MentorAnswer({ c, mentor, deptLabel, onProfile }) {
  return (
    <li className="mt-[12px] rounded-[16px] border border-mint bg-[linear-gradient(135deg,#ffffff_0%,#e8faf7_100%)] px-[18px] py-[18px]">
      <div className="flex items-center gap-[10px]">
        <Avatar year={mentor.year} size={40} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-[6px]">
            <span className="truncate text-[14px] font-bold leading-[20px] text-navy">{c.author}</span>
            <span className="shrink-0 text-[12px] text-gray">{timeAgo(c.at)}</span>
          </p>
          <p className="truncate text-[12px] font-medium leading-[17px] text-mint-deep">{`재학생 · ${deptLabel} ${mentor.year}학년`}</p>
        </div>
      </div>
      <p className="mt-[10px] whitespace-pre-wrap text-[14px] leading-[22px] text-ink-2">{c.body}</p>
      <button onClick={onProfile} className="pressable mt-[10px] flex min-h-[32px] items-center text-[12.5px] font-bold text-mint-deep">
        프로필 보기 →<span className="sr-only">{`: ${c.author}`}</span>
      </button>
    </li>
  );
}

export function QuestionDetail({ question, deptFull, mentorOf, deptLabel, onBack, onComment, onProfile, inert }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const send = (e) => {
    e.preventDefault();
    const problem = checkComment(draft);
    setError(problem || "");
    if (problem) return;
    onComment(draft);
    setDraft("");
  };
  // 재학생 댓글을 먼저, 나머지는 쓴 순서대로.
  const comments = [...question.comments.filter((c) => mentorOf(c.mentor)), ...question.comments.filter((c) => !mentorOf(c.mentor))];
  const footer = (
    <form onSubmit={send} className="border-t border-track px-[20px] pt-[10px]">
      <div className="flex items-center gap-[10px]">
        <label htmlFor="comment-input" className="sr-only">
          댓글
        </label>
        <input
          id="comment-input"
          value={draft}
          maxLength={COMMENT_MAX}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError("");
          }}
          placeholder="선배와 친구에게 댓글 남기기"
          autoComplete="off"
          enterKeyHint="send"
          className={`h-[44px] min-w-0 flex-1 ${INPUT} rounded-[10px]`}
        />
        <button type="submit" disabled={!draft.trim()} aria-label="댓글 등록" className="pressable flex h-[44px] w-[44px] shrink-0 items-center justify-center text-mint disabled:text-faint">
          <SendIcon />
        </button>
      </div>
      <p role="alert" className="min-h-[18px] pt-[2px] text-[12px] text-[#c4373b]">
        {error}
      </p>
    </form>
  );
  return (
    <View title="질문" onBack={onBack} inert={inert} footer={footer}>
      <article className="px-[20px] pb-[24px] pt-[12px]">
        <p className="text-[12px] font-medium text-mint-deep">{deptFull}</p>
        <h2 className="mt-[8px] text-[22px] font-bold leading-[31px] text-navy">{question.title}</h2>
        <p className="mt-[8px] text-[12px] text-gray">{`${question.author} · ${timeAgo(question.at)}`}</p>
        <p className="mt-[16px] whitespace-pre-wrap text-[15px] leading-[25px] text-ink-2">{question.body}</p>
        <section aria-labelledby="comments-title" className="mt-[24px] border-t border-track pt-[20px]">
          <SectionTitle id="comments-title">{`댓글 ${question.comments.length}`}</SectionTitle>
          {comments.length === 0 && <p className="mt-[10px] text-[13px] text-ink-3">아직 댓글이 없어요. 첫 댓글을 남겨 보세요.</p>}
          <ul>
            {comments.map((c) => {
              const mentor = mentorOf(c.mentor);
              if (mentor) return <MentorAnswer key={c.id} c={c} mentor={mentor} deptLabel={deptLabel(mentor.dept)} onProfile={() => onProfile(mentor.id)} />;
              return (
                <li key={c.id} className="border-b border-track py-[16px] last:border-b-0">
                  <p className="flex items-center gap-[6px] text-[13px] leading-[19px]">
                    <span className="font-bold text-navy">{c.author}</span>
                    <span className="text-[12px] text-gray">{timeAgo(c.at)}</span>
                  </p>
                  <p className="mt-[6px] whitespace-pre-wrap text-[14px] leading-[21px] text-ink-2">{c.body}</p>
                </li>
              );
            })}
          </ul>
        </section>
      </article>
    </View>
  );
}

/* ---------- 질문 쓰기 ---------- */

export function QuestionWrite({ departments, initialDept, onCancel, onSubmit }) {
  const [form, setForm] = useState({ dept: initialDept || "", title: "", body: "" });
  const [error, setError] = useState("");
  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (error) setError("");
  };
  const submit = (e) => {
    e.preventDefault();
    const problem = checkPost(form, departments);
    setError(problem || "");
    if (!problem) onSubmit(form);
  };
  const footer = (
    <div className="px-[20px] pt-[6px]">
      <p role="alert" className="min-h-[20px] pb-[4px] text-center text-[12.5px] text-[#c4373b]">
        {error}
      </p>
      <button type="submit" form="question-form" className="pressable flex h-[68px] w-full items-center justify-center rounded-[16px] border border-mint bg-white text-[19px] font-medium text-mint active:bg-mint-soft">
        질문 등록하기
      </button>
      <p className="pt-[8px] text-center text-[11px] text-gray">미리보기라 올린 글은 새로고침하면 사라져요.</p>
    </div>
  );
  return (
    <View title="질문하기" onBack={onCancel} footer={footer}>
      <form id="question-form" onSubmit={submit} className="px-[20px] pb-[20px] pt-[16px]">
        <fieldset>
          <legend className="text-[18px] font-bold leading-[26px] text-navy">어떤 학과에 대한 질문인가요?</legend>
          <div className="mt-[12px] flex flex-wrap gap-[8px]">
            {departments.map((d) => (
              <label
                key={d.id}
                className={`pressable relative flex h-[36px] cursor-pointer items-center rounded-full border px-[14px] text-[13px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-mint ${
                  form.dept === d.id ? "border-mint bg-mint font-bold text-white" : "border-slate/35 bg-[#f6f7f4] font-medium text-slate"
                }`}
              >
                <input type="radio" name="dept" value={d.id} checked={form.dept === d.id} onChange={set("dept")} className="sr-only" />
                {d.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label htmlFor="post-title" className="mt-[28px] block text-[14px] font-bold text-slate">
          제목
        </label>
        <input id="post-title" value={form.title} maxLength={TITLE_MAX} onChange={set("title")} placeholder="예: 이 학과 실제로 어때요?" autoComplete="off" className={`mt-[8px] h-[52px] w-full ${INPUT} rounded-[10px]`} />
        <p className="mt-[4px] text-right text-[11.5px] text-gray tabular-nums">{`${form.title.length} / ${TITLE_MAX}`}</p>
        <label htmlFor="post-body" className="mt-[12px] block text-[14px] font-bold text-slate">
          내용
        </label>
        <textarea
          id="post-body"
          value={form.body}
          maxLength={BODY_MAX}
          onChange={set("body")}
          rows={7}
          placeholder="궁금한 점을 자세히 적어 주세요."
          className={`mt-[8px] w-full resize-none py-[14px] leading-[24px] ${INPUT} rounded-[10px]`}
        />
        <p className="mt-[4px] text-right text-[11.5px] text-gray tabular-nums">{`${form.body.length.toLocaleString()} / ${BODY_MAX.toLocaleString()}`}</p>
      </form>
    </View>
  );
}

/* ---------- 선배 프로필 ---------- */

export function MentorProfile({ mentor, deptLabel, questions, deptName, blocked, onOpenQuestion, onMessage, onBack, inert }) {
  const answered = answeredBy(questions, mentor.id);
  const footer = (
    <div className="px-[20px] pt-[10px]">
      <p className="pb-[8px] text-center text-[11px] text-gray">{blocked ? "차단한 선배예요. 쪽지 화면에서 차단을 풀 수 있어요." : "선배에게 먼저 쪽지를 보낼 수 있어요. 연락처는 공유되지 않아요."}</p>
      <button onClick={onMessage} className="pressable flex h-[56px] w-full items-center justify-center rounded-[10px] bg-mint text-[16px] font-bold text-white active:brightness-95">
        {blocked ? "쪽지 화면 열기" : "쪽지 보내기"}
      </button>
    </div>
  );
  return (
    <View title="선배 프로필" onBack={onBack} inert={inert} footer={footer}>
      <div className="px-[20px] pb-[24px] pt-[12px]">
        <div className="flex items-center gap-[14px]">
          <Avatar year={mentor.year} size={64} />
          <div className="min-w-0">
            <p className="flex items-center gap-[6px]">
              <span className="truncate text-[19px] font-bold leading-[27px] text-navy">{mentor.nickname}</span>
              <MentorTag />
            </p>
            <p className="text-[13px] font-medium leading-[19px] text-mint-deep">{`${deptLabel} · ${mentor.year}학년`}</p>
            <p className="text-[12px] leading-[17px] text-gray">{`답변 ${answered.length}개`}</p>
          </div>
        </div>
        <p className="mt-[14px] text-[14px] leading-[22px] text-ink-3">{mentor.intro}</p>
        <section aria-labelledby="mentor-topics" className="mt-[24px] border-t border-track pt-[24px]">
          <SectionTitle id="mentor-topics">이런 이야기 나눌 수 있어요</SectionTitle>
          <ul className="mt-[12px] grid gap-[10px]">
            {mentor.topics.map(([kind, text]) => (
              <li key={kind + text} className="flex items-center gap-[14px]">
                <span className="flex h-[28px] shrink-0 items-center rounded-full border border-mint bg-white px-[12px] text-[12px] font-bold text-mint">{kind}</span>
                <span className="text-[13px] leading-[19px] text-slate">{text}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="mentor-answers" className="mt-[28px]">
          <SectionTitle id="mentor-answers">{`답변한 글 ${answered.length}`}</SectionTitle>
          {answered.length === 0 ? (
            <p className="mt-[10px] text-[13px] text-ink-3">아직 답변한 글이 없어요.</p>
          ) : (
            <ul className="mt-[4px]">
              {answered.map((q) => (
                <QuestionRow key={q.id} q={q} deptName={deptName(q.dept)} onOpen={() => onOpenQuestion(q.id)} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </View>
  );
}

/* ---------- 쪽지함 ---------- */

export function Inbox({ threads, mentorOf, questionOf, onOpen, onBack, inert }) {
  const list = sortThreads(threads);
  return (
    <View
      title="쪽지함"
      onBack={onBack}
      inert={inert}
      footer={
        <p className="px-[20px] pt-[10px] text-center text-[11px] leading-[17px] text-gray">
          쪽지는 내가 먼저 보낼 수 있고, 선배는 답장만 할 수 있어요.
          <br />
          불편한 쪽지는 대화방 오른쪽 위 ··· 에서 차단해 주세요.
        </p>
      }
    >
      <div className="px-[20px] pb-[24px] pt-[4px]">
        {list.length === 0 ? (
          <p className="mt-[40px] text-center text-[14px] leading-[22px] text-ink-3" role="status">
            아직 주고받은 쪽지가 없어요.
            <br />
            선배 프로필에서 쪽지를 보내 보세요.
          </p>
        ) : (
          <ul>
            {list.map((t) => {
              const m = mentorOf(t.mentor);
              if (!m) return null;
              const last = lastMessage(t);
              const post = questionOf(t.post);
              const unread = !t.read && !t.blocked;
              return (
                <li key={t.id} className="border-b border-track">
                  <button onClick={() => onOpen(t.mentor)} className="pressable flex w-full items-center gap-[12px] py-[16px] text-left active:bg-chalk">
                    <Avatar year={m.year} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-[6px]">
                        <span className="truncate text-[14px] font-bold leading-[20px] text-navy">{m.nickname}</span>
                        <MentorTag />
                        <span className="ml-auto shrink-0 text-[11px] text-gray">{timeAgo(last.at)}</span>
                      </span>
                      <span className="mt-[2px] flex items-center gap-[8px]">
                        <span className={`min-w-0 flex-1 truncate text-[13px] leading-[19px] ${t.blocked ? "text-mute" : "text-ink-3"}`}>{t.blocked ? "차단한 선배예요" : `${last.from === "me" ? "나: " : ""}${last.body}`}</span>
                        {unread && (
                          <span className="flex h-[18px] shrink-0 items-center rounded-full bg-mint px-[6px] text-[10.5px] font-bold text-white">
                            새 쪽지
                          </span>
                        )}
                      </span>
                      {post && <span className="mt-[2px] block truncate text-[11px] font-medium leading-[16px] text-mint-deep">{`${post.title} 글에서`}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </View>
  );
}

/* ---------- 쪽지 대화 ---------- */

const clock = (at) => new Date(at).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
const day = (at) => {
  const d = new Date(at);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

export function Chat({ mentor, thread, post, onSend, onBlock, onOpenPost, onBack, inert }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(false);
  const body = useRef(null);
  const count = thread?.messages.length || 0;
  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [count]);
  const blocked = Boolean(thread?.blocked);
  const send = (e) => {
    e.preventDefault();
    const problem = checkMessage(draft);
    setError(problem || "");
    if (problem) return;
    onSend(draft);
    setDraft("");
  };
  const footer = blocked ? (
    <div className="flex items-center justify-between gap-[10px] border-t border-track px-[20px] py-[14px]">
      <p className="text-[13px] text-ink-3">차단한 선배예요. 쪽지를 보낼 수 없어요.</p>
      <button onClick={() => onBlock(false)} className="button ghost min-h-[36px] shrink-0 text-[13px]">
        차단 풀기
      </button>
    </div>
  ) : (
    <form onSubmit={send} className="border-t border-track px-[20px] pt-[10px]">
      <div className="flex items-center gap-[10px]">
        <label htmlFor="message-input" className="sr-only">
          쪽지
        </label>
        <input
          id="message-input"
          value={draft}
          maxLength={MESSAGE_MAX}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError("");
          }}
          placeholder="쪽지 보내기"
          autoComplete="off"
          enterKeyHint="send"
          className={`h-[44px] min-w-0 flex-1 ${INPUT} rounded-[10px]`}
        />
        <button type="submit" disabled={!draft.trim()} aria-label="쪽지 보내기" className="pressable flex h-[44px] w-[44px] shrink-0 items-center justify-center text-mint disabled:text-faint">
          <SendIcon />
        </button>
      </div>
      <p role="alert" className="min-h-[18px] pt-[2px] text-[12px] text-[#c4373b]">
        {error}
      </p>
    </form>
  );
  const more = thread && !blocked && (
    <button aria-label="대화 메뉴" onClick={() => setAsking(true)} className="pressable flex h-[40px] w-[40px] items-center justify-center text-gray">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="currentColor">
        <circle cx="5" cy="12" r="1.8" />
        <circle cx="12" cy="12" r="1.8" />
        <circle cx="19" cy="12" r="1.8" />
      </svg>
    </button>
  );
  let lastDay = "";
  return (
    <>
    <View title={mentor.nickname} onBack={onBack} inert={inert || asking} right={more} footer={footer} bodyRef={body}>
      {post && (
        <button onClick={onOpenPost} className="pressable flex w-full items-center gap-[10px] border-y border-track bg-[#f6f7f4] px-[20px] py-[10px] text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] leading-[16px] text-gray">이 글에서 시작된 쪽지예요</span>
            <span className="block truncate text-[13px] font-medium leading-[19px] text-slate">{post.title}</span>
          </span>
          <Chevron />
        </button>
      )}
      <div className="px-[20px] pb-[20px] pt-[16px]">
        <p className="rounded-[10px] bg-[#f6f7f4] px-[14px] py-[10px] text-center text-[11.5px] leading-[17px] text-ink-3" role="note">
          연락처·SNS 계정은 주고받지 마세요.
          <br />
          미리보기에서는 선배가 답장하지 않고, 보낸 쪽지는 새로고침하면 사라져요.
        </p>
        {count === 0 && <p className="mt-[24px] text-center text-[13px] text-ink-3">{`${mentor.nickname}님에게 첫 쪽지를 보내 보세요.`}</p>}
        <ol className="mt-[8px] grid gap-[8px]" aria-label="쪽지 내용">
          {(thread?.messages || []).map((msg) => {
            const today = day(msg.at);
            const showDay = today !== lastDay;
            lastDay = today;
            const mine = msg.from === "me";
            return (
              <li key={msg.id}>
                {showDay && <p className="py-[10px] text-center text-[11px] text-gray">{today}</p>}
                <div className={`flex items-end gap-[6px] ${mine ? "flex-row-reverse" : ""}`}>
                  {!mine && <Avatar year={mentor.year} size={32} />}
                  <p
                    className={`max-w-[240px] whitespace-pre-wrap px-[14px] py-[10px] text-[14px] leading-[21px] text-ink-2 ${
                      mine ? "rounded-[14px] rounded-tr-[4px] border border-mint/50 bg-mint-soft" : "rounded-[14px] rounded-tl-[4px] bg-[#f6f7f4]"
                    }`}
                  >
                    <span className="sr-only">{mine ? "나: " : `${mentor.nickname}: `}</span>
                    {msg.body}
                  </p>
                  <span className="shrink-0 pb-[2px] text-[10px] text-gray">{clock(msg.at)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </View>
      {asking && (
        <Dialog
          title={`${mentor.nickname}님을 차단할까요?`}
          onClose={() => setAsking(false)}
          actions={
            <>
              <button
                className="button danger"
                onClick={() => {
                  onBlock(true);
                  setAsking(false);
                }}
              >
                차단하기
              </button>
              <button className="button ghost" onClick={() => setAsking(false)}>
                취소
              </button>
            </>
          }
        >
          차단하면 이 선배와 쪽지를 주고받을 수 없어요. 대화방에서 언제든 차단을 풀 수 있어요.
        </Dialog>
      )}
    </>
  );
}
