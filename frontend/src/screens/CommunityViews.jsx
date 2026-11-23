// 커뮤니티(미리보기)의 부품과 덮는 화면들: 질문 줄·선배 줄, 질문 상세, 질문 쓰기, 선배 프로필.
// 모양은 피그마 "릿톤" 파일의 커뮤니티 리디자인 페이지(node 294:350)를, 흐름과 문구는 manyfast(F-DPIKIB, F-TQHCMN)를 따른다.
import { useEffect, useRef, useState } from "react";
import { icon, yearCharacter } from "../assets.js";
import { Mask } from "../ui.jsx";
import { BODY_MAX, COMMENT_MAX, MENTOR_LABEL, TITLE_MAX, checkComment, checkPost, hasMentorAnswer, timeAgo } from "../community.js";
import { Chevron, INPUT } from "./shared.jsx";

/* ---------- 아이콘(선 아이콘, 2px) ---------- */
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
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

/** 예시 선배 이름표("예시 재학생"). */
export function MentorTag() {
  return <span className="inline-flex h-[18px] shrink-0 items-center rounded-full border border-mint/60 px-[7px] text-[10.5px] font-medium text-mint-deep">{MENTOR_LABEL}</span>;
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
        {hasMentorAnswer(q) && <span className="font-medium text-mint-deep">{`${MENTOR_LABEL} 답변`}</span>}
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

/** 재학생 카드 한 줄: 누르면 선배 프로필. */
export function MentorRow({ m, deptLabel, onOpen }) {
  return (
    <li className="border-b border-track">
      <button onClick={onOpen} className="pressable flex w-full gap-[14px] py-[20px] text-left active:bg-chalk" aria-label={`${m.nickname}, ${deptLabel} ${m.year}학년 ${MENTOR_LABEL} 프로필`}>
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
        </span>
        <span className="self-center text-faint" aria-hidden>
          <Chevron />
        </span>
      </button>
    </li>
  );
}

/* ---------- 덮는 화면의 틀 ---------- */

/**
 * 커뮤니티 안에서 위로 쌓이는 화면. 위쪽 줄(뒤로·제목), 가운데 스크롤, 아래 고정 영역.
 * 열리면 제목에 초점을 두고, Esc를 누르면 닫는다. 아래에 깔린 화면은 inert라 초점이 넘어가지 않는다.
 */
export function View({ title, onBack, footer, children, inert }) {
  const heading = useRef(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  // Esc는 맨 위 화면만 닫는다. 초점이 사라진 뒤에도 닫히게 창 전체에서 듣는다.
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
          <h1 ref={heading} tabIndex={-1} className="min-w-0 flex-1 truncate px-[4px] text-center text-[14px] font-medium leading-[22px] text-mint outline-none">
            {title}
          </h1>
          <span className="h-[40px] w-[40px] shrink-0" aria-hidden />
        </div>
        <div className="flow no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 bg-white" style={{ paddingBottom: "calc((36 - var(--bt)) * 1px)" }}>
            {footer}
          </div>
        )}
      </div>
    </section>
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
          <p className="truncate text-[12px] font-medium leading-[17px] text-mint-deep">{`${MENTOR_LABEL} · ${deptLabel} ${mentor.year}학년`}</p>
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

/**
 * 선배 프로필. 아래 안내는 manyfast S-KQJDZF: 그 학과를 졸업하지 않았으면 "졸업하면 예약할 수 있어요"와 학과 홈,
 * 졸업했으면 예약이 아직 없어서(2단계) 누르는 버튼 없이 준비 중이라고만 적는다.
 */
export function MentorProfile({ mentor, deptLabel, graduated, onDeptHome, onBack, inert }) {
  const footer = (
    <div className="px-[20px] pt-[10px]">
      {graduated ? (
        <p className="flex h-[56px] items-center justify-center rounded-[10px] bg-[#f6f7f4] text-[14px] font-medium text-ink-3" role="note">
          커피챗 예약은 준비 중이에요
        </p>
      ) : (
        <>
          <p className="pb-[8px] text-center text-[12.5px] text-ink-3">이 학과를 졸업하면 예약할 수 있어요</p>
          <button onClick={onDeptHome} className="pressable flex h-[56px] w-full items-center justify-center rounded-[10px] bg-mint text-[16px] font-bold text-white active:brightness-95">
            학과 홈
          </button>
        </>
      )}
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
      </div>
    </View>
  );
}
