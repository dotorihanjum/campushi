// 커뮤니티(미리보기): 질문 게시판 첫 화면(많이 본 글, 새 글 4개, 추천하는 선배)과 그 위로 쌓이는 화면들(CommunityViews.jsx).
// 피그마 "릿톤" 파일의 커뮤니티 리디자인 페이지(node 294:350)를 따른다. 질문·재학생 탭은 없애고, 선배는 검색과 프로필·쪽지로 만난다.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { icon, yearCharacter } from "../assets.js";
import { Mask, Screen, Toast } from "../ui.jsx";
import { GROUPS } from "../groups.js";
import {
  ALL,
  MINE,
  PREVIEW_COUNT,
  addComment,
  addQuestion,
  answeredBy,
  communityStore,
  featuredQuestion,
  filterQuestions,
  markRead,
  messageStore,
  recommendMentors,
  searchCommunity,
  sendMessage,
  setBlocked,
  unreadCount,
} from "../community.js";
import { MOCK_MENTORS } from "../communityMock.js";
import { TAB_H, TAB_TOP, TabBar, all } from "./shared.jsx";
import { AllQuestions, Chat, FeaturedQuestion, FilterChips, Inbox, MailIcon, MentorProfile, MentorRow, MoreButton, QuestionDetail, QuestionRow, QuestionWrite, Search, SearchIcon, SectionTitle, WriteButton } from "./CommunityViews.jsx";

const mentorOf = (id) => MOCK_MENTORS.find((m) => m.id === id) || null;

/** 커뮤니티 탭(미리보기). 데이터는 communityMock.js의 예시이고, 새 글·댓글·쪽지는 메모리에만 남는다. */
export function Community({ nav, route, state, active }) {
  const departments = all(state);
  const deptName = (id) => departments.find((d) => d.id === id)?.name || "학과";
  const deptFull = (id) => {
    const d = departments.find((x) => x.id === id);
    return d ? `${d.school} ${d.name}` : "학과";
  };
  const startDept = typeof route?.params?.dept === "string" ? route.params.dept : null;
  const [filter, setFilter] = useState(startDept || ALL);
  // 위로 쌓이는 화면: { type: "all" | "search" | "question" | "write" | "mentor" | "inbox" | "chat", id?, post? }
  const [views, setViews] = useState([]);
  const push = (view) => setViews((list) => [...list, view]);
  const pop = () => setViews((list) => list.slice(0, -1));
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const say = (text) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  };

  const questions = useSyncExternalStore(communityStore.subscribe, communityStore.get);
  const threads = useSyncExternalStore(messageStore.subscribe, messageStore.get);
  const shown = filterQuestions(questions, filter, departments, state.journeys);
  const featured = featuredQuestion(shown);
  const latest = shown.filter((q) => q !== featured).slice(0, PREVIEW_COUNT);
  const mentors = recommendMentors(MOCK_MENTORS, questions, filter, departments, state.journeys);
  const unread = unreadCount(threads);
  const questionOf = (id) => questions.find((q) => q.id === id) || null;
  const threadOf = (mentorId) => threads.find((t) => t.mentor === mentorId) || null;

  const chips = [
    { id: ALL, label: "전체" },
    { id: MINE, label: "내가 체험한 학과" },
    ...GROUPS.filter((g) => departments.some((d) => d.studyGroup === g.id)).map((g) => ({ id: g.id, label: g.name })),
    ...(startDept && departments.some((d) => d.id === startDept) ? [{ id: startDept, label: deptName(startDept) }] : []),
  ];
  const noJourney = filter === MINE && !Object.keys(state.journeys).length;
  const emptyText = noJourney ? "아직 체험 중인 학과가 없어요.\n홈 지도에서 학과에 입학해 보세요." : "아직 이 분야 질문이 없어요.\n체험하며 궁금했던 걸 가장 먼저 물어보세요.";

  // 새 글을 올리면 그 글이 보이게, 지금 필터가 그 글을 가리면 전체로 돌린다.
  const keepsVisible = (dept) => filterQuestions([{ dept }], filter, departments, state.journeys).length > 0;
  const openChat = (mentorId, post = null) => {
    const thread = threadOf(mentorId);
    if (thread && !thread.read) messageStore.set(markRead(messageStore.get(), thread.id));
    push({ type: "chat", id: mentorId, post });
  };

  const top = views.length - 1;
  const render = (view, i) => {
    const inert = i !== top;
    const key = `${i}-${view.type}-${view.id || ""}`;
    switch (view.type) {
      case "all":
        return (
          <AllQuestions
            key={key}
            inert={inert}
            questions={shown}
            chips={chips}
            filter={filter}
            onFilter={setFilter}
            deptName={deptName}
            empty={emptyText.replace("\n", " ")}
            onOpen={(id) => push({ type: "question", id })}
            onWrite={() => push({ type: "write" })}
            canWrite={departments.length > 0}
            onBack={pop}
          />
        );
      case "search":
        return (
          <Search
            key={key}
            inert={inert}
            query={query}
            onQuery={setQuery}
            result={searchCommunity(questions, MOCK_MENTORS, query, departments)}
            mentorsAll={MOCK_MENTORS}
            questions={questions}
            deptName={deptName}
            deptLabel={deptFull}
            onOpenQuestion={(id) => push({ type: "question", id })}
            onOpenMentor={(id) => push({ type: "mentor", id })}
            onMessage={(id) => openChat(id)}
            onBack={pop}
          />
        );
      case "question": {
        const q = questionOf(view.id);
        if (!q) return null;
        return (
          <QuestionDetail
            key={key}
            inert={inert}
            question={q}
            deptFull={deptFull(q.dept)}
            mentorOf={mentorOf}
            deptLabel={deptFull}
            onBack={pop}
            onComment={(body) => communityStore.set(addComment(communityStore.get(), q.id, body))}
            onProfile={(id) => push({ type: "mentor", id, post: q.id })}
          />
        );
      }
      case "write":
        return (
          <QuestionWrite
            key={key}
            departments={departments}
            initialDept={departments.some((d) => d.id === filter) ? filter : ""}
            onCancel={pop}
            onSubmit={(form) => {
              communityStore.set(addQuestion(communityStore.get(), form));
              pop();
              if (!keepsVisible(form.dept)) setFilter(ALL);
              say("질문을 올렸어요.");
            }}
          />
        );
      case "mentor": {
        const m = mentorOf(view.id);
        if (!m) return null;
        return (
          <MentorProfile
            key={key}
            inert={inert}
            mentor={m}
            deptLabel={deptFull(m.dept)}
            questions={questions}
            deptName={deptName}
            blocked={Boolean(threadOf(m.id)?.blocked)}
            onOpenQuestion={(id) => push({ type: "question", id })}
            onMessage={() => openChat(m.id, view.post || null)}
            onBack={pop}
          />
        );
      }
      case "inbox":
        return <Inbox key={key} inert={inert} threads={threads} mentorOf={mentorOf} questionOf={questionOf} onOpen={(id) => openChat(id)} onBack={pop} />;
      case "chat": {
        const m = mentorOf(view.id);
        if (!m) return null;
        const thread = threadOf(m.id);
        const post = questionOf(thread?.post || view.post);
        return (
          <Chat
            key={key}
            inert={inert}
            mentor={m}
            thread={thread}
            post={post}
            onSend={(body) => messageStore.set(sendMessage(messageStore.get(), m.id, body, view.post || null))}
            onBlock={(blocked) => {
              messageStore.set(setBlocked(messageStore.get(), thread.id, blocked));
              say(blocked ? "차단했어요." : "차단을 풀었어요.");
            }}
            onOpenPost={() => post && push({ type: "question", id: post.id })}
            onBack={pop}
          />
        );
      }
      default:
        return null;
    }
  };

  const overlay = (
    <>
      {views.map(render)}
      <Toast>{toast}</Toast>
    </>
  );
  const covered = views.length > 0;
  return (
    <Screen
      foot={TAB_TOP}
      veil={false}
      overlay={overlay}
      footer={
        <>
          <TabBar active="community" nav={nav} state={state} />
          {active && !covered && <WriteButton onClick={() => push({ type: "write" })} disabled={!departments.length} style={{ top: TAB_TOP - 16 - 48 }} />}
        </>
      }
    >
      <div inert={covered}>
        <Mask src={icon.cap} w={24} h={18} color="#087f77" className="absolute left-[23px] top-[59px]" />
        <h1 className="absolute left-[70px] right-[70px] top-[58px] text-center text-[14px] font-bold leading-[22px] text-mint">커뮤니티</h1>
        <button
          onClick={() => push({ type: "inbox" })}
          aria-label={unread ? `쪽지함, 새 쪽지 ${unread}개` : "쪽지함"}
          className="pressable absolute right-[14px] top-[49px] flex h-[40px] w-[40px] items-center justify-center text-ink-3"
        >
          <MailIcon />
          {unread > 0 && <span className="absolute right-[7px] top-[9px] h-[8px] w-[8px] rounded-full border-[1.5px] border-white bg-mint" aria-hidden />}
        </button>
        <div className="flow no-scrollbar absolute inset-x-0 top-[96px] overflow-y-auto" style={{ bottom: `calc((${TAB_H} - var(--bt)) * 1px)` }}>
          <div className="px-[20px] pt-[8px]">
            <p className="text-[24px] font-bold leading-[34px] text-navy">궁금한 건, 먼저 걸어본 선배에게</p>
            <p className="mt-[4px] text-[14px] leading-[21px] text-ink-3">체험하며 생긴 궁금증을 함께 나눠요.</p>
            <p className="mt-[10px] inline-flex rounded-full border border-cream-line bg-cream px-[10px] text-[11px] font-semibold leading-[24px] text-ink-3" role="note">
              미리보기 버전이에요 · 글과 프로필은 예시예요
            </p>
            <button
              onClick={() => {
                setQuery("");
                push({ type: "search" });
              }}
              className="pressable mt-[14px] flex h-[46px] w-full items-center gap-[8px] rounded-[10px] border border-slate/20 bg-[#f6f7f4] px-[14px] text-left text-[14px] text-gray"
            >
              <SearchIcon />
              궁금한 학과, 선배, 질문 검색
            </button>
          </div>
          <FilterChips chips={chips} value={filter} onChange={setFilter} className="mt-[14px]" />
          <div className="px-[20px] pb-[96px]">
            {shown.length === 0 ? (
              <div className="mt-[40px] flex flex-col items-center text-center" role="status">
                <img src={yearCharacter(1).src} alt="" className="h-[110px] w-[110px] object-contain" />
                <p className="mt-[16px] whitespace-pre-line text-[15px] font-medium leading-[23px] text-ink-3">{emptyText}</p>
                {noJourney ? (
                  <button onClick={() => nav.reset(["home"], "fade")} className="pressable mt-[20px] flex h-[48px] w-[200px] items-center justify-center rounded-[10px] border border-mint bg-white text-[15px] font-bold text-mint">
                    학과 둘러보기
                  </button>
                ) : (
                  <button onClick={() => push({ type: "write" })} className="pressable mt-[20px] flex h-[48px] w-[200px] items-center justify-center rounded-[10px] border border-mint bg-white text-[15px] font-bold text-mint">
                    첫 질문 남기기
                  </button>
                )}
              </div>
            ) : (
              <>
                {featured && <FeaturedQuestion q={featured} deptName={deptName(featured.dept)} onOpen={() => push({ type: "question", id: featured.id })} className="mt-[16px]" />}
                {latest.length > 0 && (
                  <section aria-labelledby="community-latest" className="mt-[28px]">
                    <SectionTitle id="community-latest">새로 올라온 질문</SectionTitle>
                    <ul className="mt-[4px]">
                      {latest.map((q) => (
                        <QuestionRow key={q.id} q={q} deptName={deptName(q.dept)} onOpen={() => push({ type: "question", id: q.id })} />
                      ))}
                    </ul>
                  </section>
                )}
                <MoreButton onClick={() => push({ type: "all" })} className="mt-[16px]">
                  {`전체 글 보기 (${shown.length})`}
                </MoreButton>
              </>
            )}
            {mentors.length > 0 && (
              <section aria-labelledby="community-mentors" className="mt-[40px]">
                <SectionTitle id="community-mentors">추천하는 선배</SectionTitle>
                <ul className="mt-[4px]">
                  {mentors.map((m) => (
                    <MentorRow
                      key={m.id}
                      m={m}
                      deptLabel={deptFull(m.dept)}
                      answers={answeredBy(questions, m.id).length}
                      onOpen={() => push({ type: "mentor", id: m.id })}
                      onMessage={() => openChat(m.id)}
                    />
                  ))}
                </ul>
                <MoreButton
                  onClick={() => {
                    setQuery("");
                    push({ type: "search" });
                  }}
                  className="mt-[16px]"
                >
                  선배 더 찾아보기
                </MoreButton>
              </section>
            )}
          </div>
        </div>
      </div>
    </Screen>
  );
}
