// 커뮤니티(미리보기): '질문'·'재학생 커피챗' 두 탭과 그 위로 쌓이는 화면들(CommunityViews.jsx).
// 흐름과 문구는 manyfast(F-DPIKIB·S-HMLROK 질문, F-TQHCMN·S-KQJDZF 멘토)를, 모양은 피그마 "릿톤" 커뮤니티 리디자인(node 294:350)을 따른다.
// manyfast 범위를 넘는 쪽지·검색·강조 질문·추천 선배는 2026-11-22 원준 결정으로 뺐다(11/26 회의에서 다시 정한다).
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { icon, yearCharacter } from "../assets.js";
import { Mask, Screen, Toast } from "../ui.jsx";
import { GROUPS } from "../groups.js";
import { progressOf } from "../model.js";
import { ALL, MINE, addComment, addQuestion, communityStore, filterMentors, filterQuestions } from "../community.js";
import { MOCK_MENTORS } from "../communityMock.js";
import { TAB_H, TAB_TOP, TabBar, all } from "./shared.jsx";
import { FilterChips, MentorProfile, MentorRow, QuestionDetail, QuestionRow, QuestionWrite, WriteButton } from "./CommunityViews.jsx";

const COMMUNITY_TABS = [
  { id: "questions", label: "질문" },
  { id: "mentors", label: "재학생 커피챗" },
];

const mentorOf = (id) => MOCK_MENTORS.find((m) => m.id === id) || null;

/** 빈 목록: 캐릭터, 안내 문장, 다음 행동 버튼 하나. */
function Empty({ text, action, onAction }) {
  return (
    <div className="mt-[40px] flex flex-col items-center text-center" role="status">
      <img src={yearCharacter(1).src} alt="" className="h-[110px] w-[110px] object-contain" />
      <p className="mt-[16px] whitespace-pre-line text-[15px] font-medium leading-[23px] text-ink-3">{text}</p>
      <button onClick={onAction} className="pressable mt-[20px] flex h-[48px] w-[200px] items-center justify-center rounded-[10px] border border-mint bg-white text-[15px] font-bold text-mint">
        {action}
      </button>
    </div>
  );
}

/** 커뮤니티 탭(미리보기). 데이터는 communityMock.js의 예시이고, 새 글·댓글은 메모리에만 남는다. */
export function Community({ nav, route, state, setState, active }) {
  const departments = all(state);
  const deptName = (id) => departments.find((d) => d.id === id)?.name || "학과";
  const deptFull = (id) => {
    const d = departments.find((x) => x.id === id);
    return d ? `${d.school} ${d.name}` : "학과";
  };
  const startDept = typeof route?.params?.dept === "string" ? route.params.dept : null;
  const [tab, setTab] = useState(() => (COMMUNITY_TABS.some((t) => t.id === route?.params?.tab) ? route.params.tab : "questions"));
  const [filter, setFilter] = useState(startDept || ALL);
  // 위로 쌓이는 화면: { type: "question" | "write" | "mentor", id? }
  const [views, setViews] = useState([]);
  const push = (view) => setViews((list) => [...list, view]);
  const pop = () => setViews((list) => list.slice(0, -1));
  const [toast, setToast] = useState("");
  const toastTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const say = (text) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  };

  const questions = useSyncExternalStore(communityStore.subscribe, communityStore.get);
  const shown = filterQuestions(questions, filter, departments, state.journeys);
  const mentors = filterMentors(MOCK_MENTORS, filter, departments, state.journeys);
  const questionOf = (id) => questions.find((q) => q.id === id) || null;

  const chips = [
    { id: ALL, label: "전체" },
    { id: MINE, label: "내가 체험한 학과" },
    ...GROUPS.filter((g) => departments.some((d) => d.studyGroup === g.id)).map((g) => ({ id: g.id, label: g.name })),
    ...(startDept && departments.some((d) => d.id === startDept) ? [{ id: startDept, label: deptName(startDept) }] : []),
  ];
  const noJourney = filter === MINE && !Object.keys(state.journeys).length;
  const write = () => push({ type: "write" });
  const browse = () => nav.reset(["home"], "fade");

  // 새 글을 올리면 그 글이 보이게, 지금 필터가 그 글을 가리면 전체로 돌린다.
  const keepsVisible = (dept) => filterQuestions([{ dept }], filter, departments, state.journeys).length > 0;
  // 선배 프로필의 "학과 홈": 입학한 학과면 학과 홈, 아니면 학과 상세(홈 지도에서 학과를 누를 때와 같다).
  const openDept = (id) => {
    setState((s) => ({ ...s, current: id }));
    nav.push(state.journeys[id] ? "major" : "detail");
  };

  const top = views.length - 1;
  const render = (view, i) => {
    const inert = i !== top;
    const key = `${i}-${view.type}-${view.id || ""}`;
    switch (view.type) {
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
            onProfile={(id) => push({ type: "mentor", id })}
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
              setTab("questions");
              if (!keepsVisible(form.dept)) setFilter(ALL);
              say("질문을 올렸어요.");
            }}
          />
        );
      case "mentor": {
        const m = mentorOf(view.id);
        const d = m && departments.find((x) => x.id === m.dept);
        if (!m) return null;
        return (
          <MentorProfile
            key={key}
            inert={inert}
            mentor={m}
            deptLabel={deptFull(m.dept)}
            graduated={Boolean(d && progressOf(state, d).graduated)}
            onDeptHome={() => openDept(m.dept)}
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
          {active && !covered && tab === "questions" && <WriteButton onClick={write} disabled={!departments.length} style={{ top: TAB_TOP - 16 - 48 }} />}
        </>
      }
    >
      <div inert={covered}>
        <Mask src={icon.cap} w={24} h={18} color="#087f77" className="absolute left-[23px] top-[59px]" />
        <h1 className="absolute left-[70px] right-[70px] top-[58px] text-center text-[14px] font-bold leading-[22px] text-mint">커뮤니티</h1>
        <div className="flow no-scrollbar absolute inset-x-0 top-[96px] overflow-y-auto" style={{ bottom: `calc((${TAB_H} - var(--bt)) * 1px)` }}>
          <div className="px-[20px] pt-[8px]">
            <p className="text-[24px] font-bold leading-[34px] text-navy">궁금한 건, 먼저 걸어본 선배에게</p>
            <p className="mt-[4px] text-[14px] leading-[21px] text-ink-3">체험하며 생긴 궁금증을 함께 나눠요.</p>
            <p className="mt-[10px] inline-flex rounded-full border border-cream-line bg-cream px-[10px] text-[11px] font-semibold leading-[24px] text-ink-3" role="note">
              미리보기 버전이에요 · 글과 프로필은 예시예요
            </p>
          </div>
          <div role="tablist" aria-label="커뮤니티 메뉴" className="mx-[20px] mt-[16px] flex border-b border-track">
            {COMMUNITY_TABS.map((t) => (
              <button
                key={t.id}
                id={`community-tab-${t.id}`}
                role="tab"
                aria-selected={tab === t.id}
                aria-controls="community-panel"
                onClick={() => setTab(t.id)}
                className={`pressable -mb-px h-[46px] flex-1 border-b-2 text-[15px] ${tab === t.id ? "border-mint font-bold text-navy" : "border-transparent font-medium text-gray"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div id="community-panel" role="tabpanel" aria-labelledby={`community-tab-${tab}`}>
            <FilterChips chips={chips} value={filter} onChange={setFilter} className="mt-[14px]" />
            <div className="px-[20px] pb-[96px]">
              {noJourney ? (
                <Empty text={"아직 체험 중인 학과가 없어요.\n홈 지도에서 학과에 입학해 보세요."} action="학과 둘러보기" onAction={browse} />
              ) : tab === "questions" ? (
                shown.length === 0 ? (
                  <Empty text={"아직 질문이 없어요.\n첫 질문을 남겨 보세요"} action="질문하기" onAction={write} />
                ) : (
                  <ul className="mt-[4px]" aria-label="질문 목록, 최신순">
                    {shown.map((q) => (
                      <QuestionRow key={q.id} q={q} deptName={deptName(q.dept)} onOpen={() => push({ type: "question", id: q.id })} />
                    ))}
                  </ul>
                )
              ) : mentors.length === 0 ? (
                <Empty text="아직 이 학과 멘토가 없어요" action="질문하기" onAction={write} />
              ) : (
                <ul className="mt-[4px]" aria-label="재학생 목록">
                  {mentors.map((m) => (
                    <MentorRow key={m.id} m={m} deptLabel={deptFull(m.dept)} onOpen={() => push({ type: "mentor", id: m.id })} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}
