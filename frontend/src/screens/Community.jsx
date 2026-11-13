// 커뮤니티(미리보기): 질문·재학생 커피챗, 질문 상세·댓글, 글쓰기.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { icon, yearCharacter } from "../assets.js";
import { Mask, Screen, T, Toast } from "../ui.jsx";
import { GROUPS } from "../groups.js";
import { ALL, BODY_MAX, COMMENT_MAX, MINE, TITLE_MAX, addComment, addQuestion, checkComment, checkPost, communityStore, filterQuestions, timeAgo } from "../community.js";
import { MOCK_MENTORS } from "../communityMock.js";
import { INPUT, TAB_H, TAB_TOP, TabBar, all } from "./shared.jsx";

const COMMUNITY_TABS = [
  { id: "questions", label: "질문" },
  { id: "mentors", label: "재학생 커피챗" },
];

/** 학과 이름표(민트 글씨 알약). */
function DeptPill({ name }) {
  return <span className="inline-flex h-[22px] max-w-full items-center truncate rounded-full bg-mint-soft px-[9px] text-[11.5px] font-bold text-mint-deep">{name}</span>;
}

/** 위쪽에 붙는 화면 이름과 미리보기 안내. */
function CommunityHead() {
  return (
    <>
      <T y={60} size={24} lh={32} left={20} className="font-bold text-navy">
        커뮤니티
      </T>
      <p className="absolute left-[132px] right-[20px] top-[58px] truncate rounded-full border border-cream-line bg-cream px-[10px] text-center text-[11px] font-semibold leading-[24px] text-ink-3" role="note">
        미리보기 버전이에요 · 글과 프로필은 예시예요
      </p>
    </>
  );
}

/** 덮는 화면(질문 상세·쓰기)의 위쪽 줄. */
function SheetTop({ label, title, onClose, close = "back" }) {
  return (
    <div className="relative flex shrink-0 items-center px-[17px] pb-[8px]" style={{ paddingTop: "calc((48 - var(--tt)) * 1px)" }}>
      <button type="button" aria-label={label} onClick={onClose} className="pressable flex h-[40px] w-[40px] items-center justify-center text-[24px] leading-none text-gray">
        {close === "back" ? <Mask src={icon.back} w={16} h={24} color="#949494" /> : "×"}
      </button>
      <span className="flex-1 pr-[40px] text-center text-[14px] text-mint">{title}</span>
    </div>
  );
}

/** 질문 상세: 본문, 댓글 목록, 댓글 입력. 화면 전체를 덮는다. */
function QuestionDetail({ question, deptName, onBack, onComment }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const heading = useRef(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const send = (e) => {
    e.preventDefault();
    const problem = checkComment(draft);
    setError(problem || "");
    if (problem) return;
    onComment(draft);
    setDraft("");
  };
  return (
    <div className="a-fade absolute inset-0 z-30 flex flex-col bg-white" onKeyDown={(e) => e.key === "Escape" && onBack()}>
      <SheetTop label="질문 목록으로" title="질문" onClose={onBack} />
      <div className="flow no-scrollbar min-h-0 flex-1 overflow-y-auto px-[20px] pb-[20px]">
        <DeptPill name={deptName} />
        <h1 ref={heading} tabIndex={-1} className="mt-[10px] text-[21px] font-bold leading-[30px] text-navy outline-none">
          {question.title}
        </h1>
        <p className="mt-[4px] text-[12px] text-gray">{`${question.author} · ${timeAgo(question.at)}`}</p>
        <p className="mt-[14px] whitespace-pre-wrap text-[14.5px] leading-[24px] text-ink-2">{question.body}</p>
        <h2 className="mt-[24px] border-t border-line pt-[16px] text-[14px] font-bold text-ink-2">{`댓글 ${question.comments.length}`}</h2>
        {question.comments.length === 0 && <p className="mt-[10px] text-[13px] text-gray">아직 댓글이 없어요. 첫 댓글을 남겨 보세요.</p>}
        <ul className="mt-[6px]">
          {question.comments.map((c) => (
            <li key={c.id} className="border-b border-line py-[12px] last:border-b-0">
              <p className="text-[12px] font-semibold text-ink-3">{`${c.author} · ${timeAgo(c.at)}`}</p>
              <p className="mt-[4px] whitespace-pre-wrap text-[14px] leading-[22px] text-ink-2">{c.body}</p>
            </li>
          ))}
        </ul>
      </div>
      <form onSubmit={send} className="shrink-0 border-t border-line bg-white px-[16px] pt-[10px]" style={{ paddingBottom: "calc((36 - var(--bt)) * 1px)" }}>
        <div className="flex items-center gap-[8px]">
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
            placeholder="댓글을 남겨 보세요"
            autoComplete="off"
            enterKeyHint="send"
            className={`h-[44px] min-w-0 flex-1 ${INPUT}`}
          />
          <button type="submit" disabled={!draft.trim()} className="button h-[44px] shrink-0">
            등록
          </button>
        </div>
        <p role="alert" className="min-h-[18px] pt-[2px] text-[12px] text-[#c4373b]">
          {error}
        </p>
      </form>
    </div>
  );
}

/** 질문 쓰기: 학과 고르기, 제목, 내용. 화면 전체를 덮는다. */
function QuestionWrite({ departments, initialDept, onCancel, onSubmit }) {
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
  return (
    <form onSubmit={submit} className="a-up absolute inset-0 z-30 flex flex-col bg-white" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <SheetTop label="쓰기 그만두기" title="질문 쓰기" onClose={onCancel} close="x" />
      <div className="flow no-scrollbar min-h-0 flex-1 overflow-y-auto px-[20px] pb-[16px]">
        <fieldset>
          <legend className="text-[14px] font-bold text-ink-2">어느 학과 질문인가요?</legend>
          <div className="mt-[8px] flex flex-wrap gap-[8px]">
            {departments.map((d) => (
              <label
                key={d.id}
                className={`pressable relative flex h-[38px] cursor-pointer items-center rounded-full border px-[14px] text-[13.5px] font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-mint ${
                  form.dept === d.id ? "border-mint bg-mint-soft text-mint-deep" : "border-line bg-white text-ink-3"
                }`}
              >
                <input type="radio" name="dept" value={d.id} checked={form.dept === d.id} onChange={set("dept")} className="sr-only" />
                {d.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label htmlFor="post-title" className="mt-[20px] block text-[14px] font-bold text-ink-2">
          제목
        </label>
        <input id="post-title" value={form.title} maxLength={TITLE_MAX} onChange={set("title")} placeholder="예: 이 학과 실제로 어때요?" autoComplete="off" className={`mt-[8px] h-[46px] w-full ${INPUT}`} />
        <p className="mt-[4px] text-right text-[11.5px] text-gray tabular-nums">{`${form.title.length} / ${TITLE_MAX}`}</p>
        <label htmlFor="post-body" className="mt-[8px] block text-[14px] font-bold text-ink-2">
          내용
        </label>
        <textarea
          id="post-body"
          value={form.body}
          maxLength={BODY_MAX}
          onChange={set("body")}
          rows={7}
          placeholder="궁금한 점을 자세히 적어 주세요."
          className={`mt-[8px] w-full resize-none py-[12px] leading-[24px] ${INPUT}`}
        />
        <p className="mt-[4px] text-right text-[11.5px] text-gray tabular-nums">{`${form.body.length.toLocaleString()} / ${BODY_MAX.toLocaleString()}`}</p>
      </div>
      <div className="shrink-0 px-[20px] pt-[6px]" style={{ paddingBottom: "calc((36 - var(--bt)) * 1px)" }}>
        <p role="alert" className="min-h-[20px] pb-[4px] text-center text-[12.5px] text-[#c4373b]">
          {error}
        </p>
        <button type="submit" className="pressable flex h-[52px] w-full items-center justify-center rounded-[14px] bg-mint text-[17px] font-semibold text-white active:brightness-95">
          올리기
        </button>
      </div>
    </form>
  );
}

/** 커뮤니티 탭(미리보기). 데이터는 communityMock.js의 예시이고, 새 글·댓글은 메모리에만 남는다. */
export function Community({ nav, route, state, active }) {
  const departments = all(state);
  const deptName = (id) => departments.find((d) => d.id === id)?.name || "학과";
  const fullName = (id) => {
    const d = departments.find((x) => x.id === id);
    return d ? `${d.school} ${d.name}` : "학과";
  };
  const startDept = typeof route?.params?.dept === "string" ? route.params.dept : null;
  const [tab, setTab] = useState(() => (COMMUNITY_TABS.some((t) => t.id === route?.params?.tab) ? route.params.tab : "questions"));
  const [filter, setFilter] = useState(startDept || ALL);
  // 고른 필터 칩이 가로 목록 밖에 있으면 보이게 민다(학과 상세에서 그 학과 칩을 골라 들어올 때 등).
  const chipRow = useRef(null);
  useEffect(() => {
    chipRow.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [filter, tab]);
  const [openId, setOpenId] = useState(null);
  const [writing, setWriting] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const questions = useSyncExternalStore(communityStore.subscribe, communityStore.get);
  const shown = filterQuestions(questions, filter, departments, state.journeys);
  const opened = questions.find((q) => q.id === openId) || null;
  const say = (text) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  };
  const chips = [
    { id: ALL, label: "전체" },
    { id: MINE, label: "내가 체험한 학과" },
    ...GROUPS.filter((g) => departments.some((d) => d.studyGroup === g.id)).map((g) => ({ id: g.id, label: g.name })),
    ...(startDept && departments.some((d) => d.id === startDept) ? [{ id: startDept, label: deptName(startDept) }] : []),
  ];
  const emptyText =
    filter === MINE && !Object.keys(state.journeys).length
      ? "아직 체험 중인 학과가 없어요. 홈 지도에서 학과에 입학해 보세요."
      : "이 학과의 질문이 아직 없어요. 첫 질문을 남겨 보세요.";
  // 새 글을 올리면 그 글이 보이게, 지금 필터가 그 글을 가리면 전체로 돌린다.
  const keepsVisible = (dept) => filterQuestions([{ dept }], filter, departments, state.journeys).length > 0;
  const overlay = (
    <>
      {opened && (
        <QuestionDetail
          question={opened}
          deptName={fullName(opened.dept)}
          onBack={() => setOpenId(null)}
          onComment={(body) => communityStore.set(addComment(communityStore.get(), opened.id, body))}
        />
      )}
      {writing && (
        <QuestionWrite
          departments={departments}
          initialDept={departments.some((d) => d.id === filter) ? filter : ""}
          onCancel={() => setWriting(false)}
          onSubmit={(form) => {
            communityStore.set(addQuestion(communityStore.get(), form));
            setWriting(false);
            if (!keepsVisible(form.dept)) setFilter(ALL);
            say("질문을 올렸어요.");
          }}
        />
      )}
      <Toast>{toast}</Toast>
    </>
  );
  return (
    <Screen
      foot={TAB_TOP}
      veil={false}
      overlay={overlay}
      footer={
        <>
          <TabBar active="community" nav={nav} state={state} />
          {tab === "questions" && active && (
            <button
              onClick={() => setWriting(true)}
              disabled={!departments.length}
              style={{ top: TAB_TOP - 15 - 52 }}
              className="pressable absolute right-[20px] z-10 flex h-[52px] items-center gap-[6px] rounded-full bg-mint px-[20px] text-[15.5px] font-bold text-white shadow-[0_8px_20px_rgba(39,216,205,0.35)] active:brightness-95 disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M10.6 2.4 13.6 5.4 5.4 13.6H2.4V10.6L10.6 2.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
              글쓰기
            </button>
          )}
        </>
      }
    >
      <CommunityHead />
      <div role="tablist" aria-label="커뮤니티 메뉴" className="absolute left-[20px] top-[100px] flex h-[42px] w-[362px] rounded-full bg-track p-[4px]">
        {COMMUNITY_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`pressable flex-1 rounded-full text-[13.5px] font-semibold ${tab === t.id ? "bg-white text-mint-deep shadow-[0_2px_6px_rgba(0,0,0,0.08)]" : "text-ink-3"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flow no-scrollbar absolute left-0 right-0 top-[152px] overflow-y-auto" style={{ bottom: `calc((${TAB_H} - var(--bt)) * 1px)` }} role="tabpanel">
        {tab === "questions" && (
          <>
            <div ref={chipRow} className="no-scrollbar flex gap-[8px] overflow-x-auto scroll-px-[20px] px-[20px] pb-[12px]" role="group" aria-label="학과 필터">
              {chips.map((c) => (
                <button
                  key={c.id}
                  aria-pressed={filter === c.id}
                  onClick={() => setFilter(c.id)}
                  className={`pressable h-[34px] shrink-0 whitespace-nowrap rounded-full border px-[13px] text-[13px] font-semibold ${filter === c.id ? "border-mint bg-mint text-white" : "border-line bg-white text-ink-3"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {shown.length === 0 ? (
              <p className="mx-[20px] mt-[8px] rounded-[16px] border border-line bg-chalk px-[16px] py-[18px] text-center text-[13.5px] leading-[21px] text-ink-3" role="status">
                {emptyText}
              </p>
            ) : (
              <ul className="grid gap-[10px] px-[20px] pb-[84px]">
                {shown.map((q) => (
                  <li key={q.id}>
                    <button onClick={() => setOpenId(q.id)} className="pressable block w-full rounded-[16px] border border-cream-line bg-cream px-[15px] py-[13px] text-left active:bg-cream-2">
                      <DeptPill name={deptName(q.dept)} />
                      <span className="mt-[7px] block truncate text-[15.5px] font-bold leading-[22px] text-slate">{q.title}</span>
                      <span className="report-text mt-[3px] text-[12.5px] leading-[19px] text-gray" style={{ WebkitLineClamp: 2 }}>
                        {q.body}
                      </span>
                      <span className="mt-[8px] flex items-center gap-[6px] text-[11.5px] text-ink-3">
                        <svg width="13" height="12" viewBox="0 0 13 12" fill="none" aria-hidden>
                          <path d="M2.2 1h8.6A1.2 1.2 0 0 1 12 2.2v5.6A1.2 1.2 0 0 1 10.8 9H5.5L2.6 11V9h-.4A1.2 1.2 0 0 1 1 7.8V2.2A1.2 1.2 0 0 1 2.2 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                        </svg>
                        <span>{`댓글 ${q.comments.length}`}</span>
                        <span aria-hidden>·</span>
                        <span>{timeAgo(q.at)}</span>
                        <span aria-hidden>·</span>
                        <span className="truncate">{q.author}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {tab === "mentors" && (
          <ul className="grid gap-[12px] px-[20px] pb-[24px]">
            {MOCK_MENTORS.map((m) => (
              <li key={m.id} className="flex gap-[12px] rounded-[18px] border border-line bg-white px-[14px] py-[14px] shadow-[0_4px_14px_rgba(0,0,0,0.04)]">
                <img src={yearCharacter(m.year).src} alt="" className="h-[56px] w-[56px] shrink-0 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-[6px]">
                    <span className="truncate text-[15px] font-bold text-ink-2">{m.nickname}</span>
                    <span className="inline-flex shrink-0 items-center gap-[3px] rounded-full bg-mint-soft px-[7px] text-[10.5px] font-bold leading-[20px] text-mint-deep">
                      <svg width="9" height="8" viewBox="0 0 11 9" fill="none" aria-hidden>
                        <path d="M1.2 4.6 4 7.3 9.8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      인증된 재학생
                    </span>
                  </p>
                  <p className="mt-[2px] truncate text-[12px] text-gray">{`${fullName(m.dept)} · ${m.year}학년`}</p>
                  <p className="mt-[6px] text-[13px] leading-[20px] text-ink-2">{m.intro}</p>
                  <button className="button ghost mt-[10px] min-h-[36px] text-[13px]" onClick={() => say("준비 중인 기능이에요.")}>
                    커피챗 신청
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
  );
}
