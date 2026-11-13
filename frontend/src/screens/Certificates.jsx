// 입학증·입학 환영·성적표·졸업증명서·졸업 화면과 체험 리포트.
import { useEffect, useRef, useState } from "react";
import { icon, img } from "../assets.js";
import { BackButton, Center, Confetti, delay, Header, Mask, OutlineButton, Paper, PaperFold, Screen, T, SchoolLogo } from "../ui.jsx";
import { YEARS, courseKey, isRequired } from "../model.js";
import { averagePoint, PASS } from "../grades.js";
import { useCountUp, useGuard, view } from "./shared.jsx";

const DAYS = "일월화수목금토";
const stamp = (date) =>
  `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${DAYS[date.getDay()]}) ${
    date.getHours() < 12 ? "오전" : "오후"
  } ${date.getHours() % 12 || 12}시`;

/** 입학증·성적표·졸업증명서의 도장. 위치와 크기는 세 화면이 같고, 등장 모션은 화면마다 넘겨받는다. */
function SchoolSeal({ d, className, style }) {
  return (
    <div className={`${className} absolute left-[112px] top-[308px] h-[40px] w-[53px]`} style={style}>
      <SchoolLogo school={d.school} kind="seal" size={40} />
    </div>
  );
}

function useAutoAdvance(fn, ms) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const t = window.setTimeout(() => ref.current(), ms);
    return () => window.clearTimeout(t);
  }, [ms]);
}

function PaperRow({ y, left, right, lineFrom = 24, lineTo = 255, d = 0 }) {
  return (
    <div className="a-fade pointer-events-none absolute inset-0" style={delay(d)}>
      <T y={y} size={11.5} left={26.5} className="text-gray">
        {left}
      </T>
      <T y={y} size={11.5} right={273 - 255.5} clip={185} className="text-gray">
        {right}
      </T>
      <span
        className="absolute h-px origin-left bg-[#c8c8c8]"
        style={{ top: y + 17.5, left: lineFrom, width: lineTo - lineFrom, animation: `line-grow 0.6s cubic-bezier(0.22,1,0.36,1) ${d + 0.05}s both` }}
      />
    </div>
  );
}

function CertificateShell({ onBack, onNext, children }) {
  return (
    <Screen bg="#27d8cd">
      <BackButton onClick={onBack} color="#fff" />
      <button aria-label="다음으로" onClick={onNext} className="absolute inset-0 top-[100px] z-0 cursor-pointer" />
      <Center>
        <Paper className="a-paper z-10 shadow-[0_18px_40px_rgba(0,80,76,0.18)]" style={delay(0.05)}>
          <PaperFold src={img.paperFold} />
          {children}
        </Paper>
      </Center>
    </Screen>
  );
}

/** 종이에 적는 증명 문구. 학교·학과 이름이 길어도 종이 안에서 줄바꿈된다. */
function Statement({ y, d, children }) {
  return (
    <div
      className="a-fade absolute left-[22px] right-[22px] whitespace-pre-line text-center text-[11px] leading-[21px] text-gray"
      style={{ top: y, wordBreak: "keep-all", ...delay(d) }}
    >
      {children}
    </div>
  );
}

export function Enrolled({ active, nav, state }) {
  const v = view(state);
  const [now] = useState(() => new Date());
  const next = () => nav.replace("welcome", undefined, "fade");
  useGuard(!!v, nav, active);
  useAutoAdvance(next, 4200);
  if (!v) return null;
  const { d } = v;
  return (
    <CertificateShell onBack={nav.back} onNext={next}>
      <T y={56} size={25} center className="a-up pl-[8px] font-bold text-mint" style={delay(0.45)}>
        입학을 축하합니다!
      </T>
      <PaperRow y={117} left="체험생" right={`${d.school} ${d.name}`} d={0.6} />
      <PaperRow y={165} left="일시" right={stamp(now)} d={0.72} />
      <Statement y={210} d={0.9}>
        {`위 사람은 ${d.school} ${d.name}의\n진로 체험을 시작할 수 있음을 증명합니다`}
      </Statement>
      <SchoolSeal d={d} className="a-pop" style={delay(1.1)} />
    </CertificateShell>
  );
}

function BottomSign({ d: department, wait }) {
  return (
    <div className="a-fade pointer-events-none absolute inset-0" style={delay(wait)}>
      <T y={288.5} size={10} left={48} className="text-gray">
        체험생
      </T>
      <T y={288.5} size={10} right={40} clip={150} className="text-gray">
        {department.school} {department.name}
      </T>
      <span
        className="absolute left-[42px] top-[309.5px] h-px w-[190.5px] origin-left bg-[#c8c8c8]"
        style={{ animation: `line-grow 0.6s cubic-bezier(0.22,1,0.36,1) ${wait}s both` }}
      />
    </div>
  );
}

export function Grades({ active, nav, state }) {
  const v = view(state);
  const next = () => nav.replace("diploma", undefined, "fade");
  const ok = !!v?.progress.graduated;
  useGuard(ok, nav, active);
  useAutoAdvance(next, 4600);
  if (!ok) return null;
  const { d, progress } = v;
  // 들은 과목을 필수부터, 학년 순서로 적는다. 종이에 다 들어가지 않으면 "외 N과목"으로 줄인다.
  const taken = [...progress.taken].sort((a, b) => b.required - a.required || a.year - b.year);
  const shown = taken.slice(0, 7);
  const average = averagePoint(taken.map((course) => course.record.grade));
  const perfect = taken.every((course) => course.record.grade === "A+" || course.record.grade === PASS);
  return (
    <CertificateShell onBack={() => nav.reset(["home"])} onNext={next}>
      <div className="absolute inset-0 overflow-hidden rounded-[8px]">
        <T y={56} size={25} center className="a-up pl-[8px] font-bold text-mint" style={delay(0.45)}>
          성적표
        </T>
        <Statement y={98} d={0.6}>
          {`위 사람은 ${d.school} ${d.name}의\n체험 과정을 모두 마쳤음을 증명합니다`}
          <span className="block text-[10.5px] leading-[18px] text-mint-deep">
            {`이수 ${progress.passedCount}과목${average === null ? "" : ` · 평균 평점 ${average.toFixed(2)} / 4.5`}`}
          </span>
        </Statement>
        <ul className="a-fade absolute left-[26px] top-[164px] w-[222px]" style={delay(0.7)} aria-label="과목별 성적">
          {shown.map((course) => (
            <li key={course.subject} className="flex gap-[6px] text-[10px] leading-[16px] text-gray">
              <span className="shrink-0 tabular-nums text-mint-deep">{course.year}학년</span>
              <span className="min-w-0 flex-1 truncate">{course.subject}</span>
              <span className="shrink-0 font-semibold text-ink-2">{course.record.grade}</span>
            </li>
          ))}
          {taken.length > shown.length && <li className="text-[10px] leading-[16px] text-gray">{`외 ${taken.length - shown.length}과목`}</li>}
        </ul>
        <BottomSign d={d} wait={0.7} />
        <SchoolSeal d={d} className="a-fade" style={delay(0.8)} />
        {perfect && (
          <img
            src={img.gradeAplus}
            alt="모두 A+"
            className="absolute left-[-4px] top-[141px] h-[191px] w-[166px]"
            style={{ animation: "stamp 0.55s cubic-bezier(0.22,1,0.36,1) 1.05s both" }}
          />
        )}
        <img
          src={img.gradeSign}
          alt=""
          className="absolute left-[131px] top-[256px] h-[72px] w-[130px]"
          style={{ animation: "wipe 0.75s cubic-bezier(0.65,0,0.35,1) 1.75s both" }}
        />
      </div>
    </CertificateShell>
  );
}

export function Diploma({ active, nav, state }) {
  const v = view(state);
  const next = () => nav.replace("graduation", undefined, "fade");
  const ok = !!v?.progress.graduated;
  useGuard(ok, nav, active);
  useAutoAdvance(next, 4200);
  if (!ok) return null;
  const { d } = v;
  return (
    <CertificateShell onBack={() => nav.reset(["home"])} onNext={next}>
      <T y={56} size={25} center className="a-up pl-[8px] font-bold text-mint" style={delay(0.45)}>
        졸업증명서
      </T>
      <PaperRow y={117} left="체험생" right={`${d.school} ${d.name}`} d={0.6} />
      <Statement y={168} d={0.8}>
        {`위 사람은 ${d.school} ${d.name}\n체험 과정을 졸업하였음을 증명합니다`}
      </Statement>
      <BottomSign d={d} wait={0.95} />
      <SchoolSeal d={d} className="a-pop" style={delay(1.15)} />
    </CertificateShell>
  );
}

export function Welcome({ active, nav, state }) {
  const v = view(state);
  useGuard(!!v?.journey, nav, active);
  if (!v?.journey) return null;
  const { d } = v;
  // 화면이 낮으면 캐릭터를 줄여서(최대 150) 그 아래 인사와 1학년 안내가 버튼에 가려지지 않게 올린다.
  const shrink = "min(150px, var(--cut) * 1px)";
  return (
    <Screen
      h={`725px - ${shrink}`}
      foot={725}
      footer={
        <>
          <button
            onClick={() => nav.reset(["home", "experience", "major"], "fade")}
            className="pressable a-up absolute left-[20px] top-[737px] flex h-[67px] w-[362px] items-center justify-center rounded-[14px] bg-mint text-[18px] font-semibold text-white active:brightness-95"
            style={delay(0.9)}
          >
            첫 과제 시작하기
          </button>
          <T y={820} size={11.5} center className="a-fade text-ink-3" style={delay(1)}>
            학년은 체험 단계예요. 내 속도에 맞춰 진행해요.
          </T>
        </>
      }
    >
      <button aria-label="뒤로" onClick={nav.back} className="pressable absolute left-[17px] top-[48px] z-20 flex h-[40px] w-[36px] items-center justify-center">
        <Mask src={icon.back} w={10} h={15} color="#2c1502" />
      </button>
      <T y={61} size={14.5} center className="font-bold text-ink">
        체험 입학
      </T>
      <div
        className="a-pop absolute left-[141px] top-[121px] flex h-[36px] w-[120px] items-center justify-center gap-[4px] rounded-full border border-mint bg-mint-soft text-[14px] font-bold text-mint-deep"
        style={delay(0.15)}
      >
        체험 입학 완료
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden>
          <path d="M1.2 4.6 4 7.3 9.8 1.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="a-drop absolute left-1/2 top-[171px] aspect-[244/252] -translate-x-1/2" style={{ height: `calc(252px - ${shrink})`, ...delay(0.3) }}>
        <img
          src={img.mascotWelcome}
          alt=""
          className="loop h-full w-full"
          style={{ animation: "hop 2.4s ease-in-out 1.3s infinite", transformOrigin: "50% 100%" }}
        />
      </div>
      <div className="absolute inset-x-0 top-0" style={{ top: `calc(-1 * ${shrink})` }}>
        <T y={458} size={d.name.length > 9 ? 21 : 28.5} lh={42} center clip={380} className="a-up font-bold text-ink" style={delay(0.6)}>
          {`반가워요,\n${d.name} 새내기!`}
        </T>
        <T y={549.5} size={14.5} center className="a-up text-ink-3" style={delay(0.7)}>
          나에게 맞는 전공인지, 직접 경험하며 알아봐요.
        </T>
        <div className="a-up absolute left-0 top-[603px] h-[115px] w-[402px] rounded-[28px] bg-cream-2" style={delay(0.8)}>
          <T y={27} size={16.5} center clip={360} className="font-bold text-ink-2">
            {`1학년 과목 ${d.years[1].length}개 · 필수 ${d.years[1].filter((subject) => isRequired(d, subject)).length}개`}
          </T>
          <T y={62.5} size={13.5} lh={20} center className="text-ink-3">
            {"필수과목을 B- 이상으로 이수하면 다음 학년이 열려요.\n4학년에는 졸업 과제에 도전해요."}
          </T>
        </div>
      </div>
    </Screen>
  );
}

// 학과에서 가장 최근에 남긴 기록(학년이 높은 과목부터).
function lastNote(state, d) {
  for (const year of [...YEARS].reverse())
    for (const subject of [...d.years[year]].reverse()) {
      const note = state.notes[courseKey(d.id, subject)];
      if (note) return note;
    }
  return "";
}

export function Graduation({ active, nav, state }) {
  const v = view(state);
  const ok = !!v?.progress.graduated;
  const taken = ok ? v.progress.taken : [];
  const average = averagePoint(taken.map((course) => course.record.grade));
  const done = useCountUp(ok ? v.progress.passedCount : 0, 900, 800);
  useGuard(ok, nav, active);
  if (!ok) return null;
  const { d } = v;
  const title = `${d.school} ${d.name}`;
  return (
    <Screen
      h={754}
      foot={754}
      veil="#feeaa0"
      footer={
        <>
          <OutlineButton onClick={() => nav.reset(["home", "experience", "major"], "fade")} className="a-up" style={delay(0.95)}>
            남은 과목 계속 듣기
          </OutlineButton>
          <button
            onClick={() => nav.reset([["home", { focus: "departments" }]], "fade")}
            className="pressable a-fade absolute left-[100px] top-[830px] h-[32px] w-[202px] text-[13px] text-mint-deep underline"
            style={delay(1.05)}
          >
            다른 학과도 체험하러 가기
          </button>
        </>
      }
    >
      <Header title="졸업을 축하합니다" onBack={() => nav.reset(["home"], "fade")} />
      <div className="a-pop absolute left-[100px] top-[128px] h-[158px] w-[190px]" style={delay(0.05)}>
        <img
          src={img.mascotGrad}
          alt=""
          className="loop h-full w-full"
          style={{ animation: "hop 2.2s ease-in-out 1s infinite", transformOrigin: "50% 100%" }}
        />
      </div>
      <Confetti originX={195} originY={215} />
      <T y={311.5} size={title.length > 13 ? 19 : 27.5} lh={40} center clip={386} className="a-up font-bold text-mint" style={delay(0.35)}>
        {`${title}\n졸업을 축하해요!`}
      </T>
      <div className="a-fade absolute left-0 top-[428px] h-[79px] w-full border-y-2 border-mint-line bg-mint-soft" style={delay(0.5)}>
        {[
          { v: "4학년", l: "체험 단계", cx: 71.5, y: 21, size: 20, ly: 46.5 },
          { v: `${done}과목`, l: "이수 과목", cx: 198, y: 21, size: 20, ly: 46.5 },
          { v: average === null ? "P" : average.toFixed(2), l: average === null ? "통과" : "평균 평점 / 4.5", cx: 327.5, y: 21, size: 20, ly: 46.5 },
        ].map((st) => (
          <div key={st.l} className="absolute top-0 w-[120px] text-center" style={{ left: st.cx - 60 }}>
            <T y={st.y} size={st.size} center className="font-bold text-mint-deep">
              {st.v}
            </T>
            <T y={st.ly} size={11.5} center className="text-gray">
              {st.l}
            </T>
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 left-0 top-[507px] w-full bg-butter">
        <div className="a-up pointer-events-none absolute inset-0" style={delay(0.65)}>
          <T y={53.5} size={21} left={21} clip={360} className="font-bold text-ink-2">
            {`나의 ${d.name} 체험 리포트`}
          </T>
        </div>
        <div className="a-up pointer-events-none absolute inset-0" style={delay(0.75)}>
          <T y={105} size={13} left={20.5} className="font-bold text-mint-deep">
            들은 과목
          </T>
          <div className="report-text absolute left-[20.5px] top-[124px] w-[360px] text-[12px] leading-[18px] text-ink-2" style={{ WebkitLineClamp: 2 }}>
            {taken.map((course) => `${course.subject} ${course.record.grade}`).join(" · ")}
          </div>
        </div>
        <div className="a-up pointer-events-none absolute inset-0" style={delay(0.85)}>
          <T y={173} size={13} left={20.5} className="font-bold text-mint-deep">
            느낀 점
          </T>
          <div className="report-text absolute left-[20.5px] top-[192px] w-[360px] text-[12px] leading-[18px] text-ink-2" style={{ WebkitLineClamp: 3 }}>
            {lastNote(state, d) || "남긴 기록이 없어요."}
          </div>
        </div>
      </div>
    </Screen>
  );
}
