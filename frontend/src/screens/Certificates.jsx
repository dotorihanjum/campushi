// 입학증·입학 환영·성적표·졸업증명서·졸업 화면과 체험 리포트.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { icon, img } from "../assets.js";
import { BackButton, Center, Confetti, delay, Header, Mask, OutlineButton, Paper, PaperFold, Screen, T, SchoolLogo } from "../ui.jsx";
import { YEARS, courseKey, welcomeGuide } from "../model.js";
import { CERTIFICATES, isReview, transcriptRows } from "../certificates.js";
import { canShareFile, isAbort, retryBy, singleFlight } from "../certificateSave.js";
import { downloadFile, renderCertificate } from "../certificateImage.js";
import { certificateFileName } from "./reportFileName.js";
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

// 다시 보기(off)에서는 다음 화면으로 넘어가지 않는다.
function useAutoAdvance(fn, ms, off = false) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (off) return;
    const t = window.setTimeout(() => ref.current(), ms);
    return () => window.clearTimeout(t);
  }, [ms, off]);
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

// 세 증명서 종이 아래에 넣는 안내(manyfast F-OAIMLW·S-IDBOLP 원문). 문구를 바꾸지 않는다.
const NOT_OFFICIAL_NOTICE = "캠퍼스하이 체험 과정 기록이며 실제 학적이 아닙니다";
// 안내의 위치·크기(종이 273×365 안의 좌표). 디자인이 정해지면 여기만 바꾼다.
// 도장(308~348)·서명 줄(309.5)보다 아래, 종이 아래 끝(365) 안쪽이다. 색은 흰 종이 위 대비 5.03:1인 slate.
const NOTICE_STYLE = { top: 350, fontSize: 10, lineHeight: "13px" };

/** 증명서 종이 안의 "실제 학적이 아닙니다" 안내. 종이를 이미지로 저장할 때(#25)도 같이 들어가도록 종이 안에 둔다. */
function NotOfficialNotice() {
  return (
    <p className="pointer-events-none absolute inset-x-[12px] m-0 text-center text-slate" style={{ ...NOTICE_STYLE, wordBreak: "keep-all" }}>
      {NOT_OFFICIAL_NOTICE}
    </p>
  );
}

// 증명서 화면 이름 → 파일 이름·버튼에 쓰는 증명서 이름(입학증·성적표·졸업증명서).
const KIND = Object.fromEntries(CERTIFICATES.map((c) => [c.screen, c.name]));

// 다시 보기 버튼 모양. 민트 배경 위의 흰 버튼이고, 키보드 포커스는 진한 남색 테두리로 보인다(흰 테두리는 민트 위에서 잘 안 보인다).
const ACTION =
  "pressable flex h-[52px] min-w-0 flex-1 items-center justify-center gap-[6px] rounded-[14px] bg-white px-[8px] text-[16px] font-semibold text-mint-deep active:bg-mint-soft aria-disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0 animate-spin">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.2" />
      <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

// 공유 창으로 파일을 보낼 수 있는지 물어볼 때 쓰는 빈 PNG. 이미지를 다 만들기 전에 공유하기 버튼을 보일지 정한다.
const SAMPLE = typeof File === "function" ? new File([""], "campushi.png", { type: "image/png" }) : null;

/**
 * 다시 보기(체험 탭에서 연 증명서, #23)의 아래 버튼 줄: 닫기 · 저장하기 · 공유하기(#25). 닫으면 체험 탭 목록으로 돌아간다.
 * 화면이 열리면 증명서 이미지를 미리 만들어 둔다. 사파리는 누른 직후에 공유 창을 열어야 해서(오래 기다리면 NotAllowedError)
 * 누를 때 만들지 않고, 만들어 둔 파일로 바로 저장·공유한다. 만드는 동안에는 버튼에 로딩 표시가 있고 눌러도 아무 일도 하지 않는다.
 */
function ReviewActions({ onClose, paper, d, kind }) {
  const name = `${d.name} ${kind}`;
  // making: 이미지를 만드는 중, ready: 만들어 둠, error: 만들지 못함(다시 시도).
  const [status, setStatus] = useState("making");
  // 저장·공유를 처리하는 중인 버튼(연타 막기).
  const [busy, setBusy] = useState(null);
  // 저장·공유 결과와 오류 안내. 화면 읽기 프로그램에도 읽히도록 role="status"에 둔다.
  const [message, setMessage] = useState("");
  const file = useRef(null);
  const lock = useRef(false);
  // 실패했을 때 다시 시도하는 방법(retryBy): 그 자리에서 다시 그리기(render) 또는 페이지 새로 부르기(reload).
  const [retryWith, setRetryWith] = useState("render");
  const shareable = useMemo(() => canShareFile(globalThis.navigator, SAMPLE), []);
  // 연타·StrictMode의 두 번 실행에도 이미지는 하나만 만든다. 실패하면 다음 호출이 다시 만든다.
  const make = useMemo(
    () => singleFlight(() => renderCertificate(paper.current, certificateFileName(d.school, d.name, kind))),
    [paper, d.school, d.name, kind],
  );
  const prepare = useCallback(() => {
    let alive = true;
    setStatus("making");
    make().then(
      (made) => {
        file.current = made;
        if (alive) setStatus("ready");
      },
      (error) => {
        console.error("증명서 이미지를 만들지 못했어요.", error);
        if (!alive) return;
        const how = retryBy(error);
        setRetryWith(how);
        setStatus("error");
        setMessage(
          how === "reload"
            ? "증명서 이미지를 만들지 못했어요. 인터넷 연결을 확인하고 다시 시도를 눌러 주세요."
            : "증명서 이미지를 만들지 못했어요. 다시 시도를 눌러 주세요.",
        );
      },
    );
    return () => {
      alive = false;
    };
  }, [make]);
  useEffect(prepare, [prepare]);
  const retry = () => {
    // 다시 보기 화면은 새로고침해도 같은 증명서로 돌아온다(App.jsx의 SETTLED 예외).
    if (retryWith === "reload") return window.location.reload();
    setMessage("");
    prepare();
  };
  // 파일 이름의 날짜는 미리 만든 날이 아니라 누른 날(기기 로컬 날짜)로 붙인다.
  const named = () => new File([file.current], certificateFileName(d.school, d.name, kind), { type: "image/png" });
  const run = (which, act) => {
    if (status !== "ready" || lock.current) return;
    lock.current = true;
    setBusy(which);
    setMessage("");
    Promise.resolve(act()).finally(() =>
      window.setTimeout(() => {
        lock.current = false;
        setBusy(null);
      }, 600),
    );
  };
  const save = () =>
    run("save", () => {
      downloadFile(named());
      setMessage("증명서 이미지를 저장했어요.");
    });
  // share는 누른 그 자리에서 바로 부른다(사이에 기다리는 작업이 있으면 사파리가 막는다).
  const share = () =>
    run("share", () => {
      let sent;
      try {
        sent = navigator.share({ files: [named()], title: `캠퍼스하이 ${name}` });
      } catch (error) {
        sent = Promise.reject(error);
      }
      return Promise.resolve(sent).then(
        () => setMessage("증명서 이미지를 공유했어요."),
        (error) => {
          // 사용자가 공유 창을 닫은 것은 오류가 아니다.
          if (isAbort(error)) return;
          console.error("증명서 이미지를 공유하지 못했어요.", error);
          setMessage("공유하지 못했어요. 저장하기로 내려받은 뒤 공유해 주세요.");
        },
      );
    });
  const waiting = (which) => status === "making" || busy === which;
  const action = (which, label, onClick) => (
    <button
      onClick={onClick}
      aria-label={`${name} ${label}`}
      aria-busy={waiting(which) || undefined}
      aria-disabled={status !== "ready" || !!busy || undefined}
      className={ACTION}
    >
      {waiting(which) && <Spinner />}
      {label}
    </button>
  );
  return (
    <>
      <p role="status" className="absolute inset-x-[20px] top-[718px] m-0 text-center text-[13.5px] font-semibold leading-[20px] text-navy" style={{ wordBreak: "keep-all" }}>
        {message}
      </p>
      <div className="absolute left-[20px] top-[766px] flex w-[362px] gap-[8px]">
        <button onClick={onClose} className={ACTION}>
          닫기
        </button>
        {status === "error" ? (
          <button onClick={retry} aria-label={`${name} 이미지 다시 만들기`} className={ACTION}>
            다시 시도
          </button>
        ) : (
          <>
            {action("save", "저장하기", save)}
            {shareable && action("share", "공유하기", share)}
          </>
        )}
      </div>
    </>
  );
}

// review: 다시 보기면 종이 밖을 눌러도 다음 화면으로 넘어가지 않고, 아래에 닫기·저장하기·공유하기 버튼을 둔다.
function CertificateShell({ onBack, onNext, review = false, d, kind, children }) {
  const paper = useRef(null);
  return (
    <Screen bg="#27d8cd" veil={false} footer={review ? <ReviewActions onClose={onBack} paper={paper} d={d} kind={KIND[kind]} /> : undefined}>
      <BackButton onClick={onBack} color="#fff" />
      {!review && <button aria-label="다음으로" onClick={onNext} className="absolute inset-0 top-[100px] z-0 cursor-pointer" />}
      <Center>
        <Paper ref={paper} className="a-paper z-10 shadow-[0_18px_40px_rgba(0,80,76,0.18)]" style={delay(0.05)}>
          <PaperFold src={img.paperFold} />
          {children}
          <NotOfficialNotice />
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

export function Enrolled({ active, nav, state, route }) {
  const v = view(state);
  const review = isReview(route?.params);
  const next = () => nav.replace("welcome", undefined, "fade");
  useGuard(review ? !!v?.journey : !!v, nav, active);
  useAutoAdvance(next, 4200, review);
  if (!v || (review && !v.journey)) return null;
  const { d, journey } = v;
  // 입학 시각을 남기기 전에 입학한 기록에는 날짜가 없으므로, 일시 줄을 빼고 체험생 줄을 두 줄 자리의 가운데에 둔다.
  const at = Number.isFinite(journey?.enrolledAt) ? new Date(journey.enrolledAt) : null;
  return (
    <CertificateShell onBack={nav.back} onNext={next} review={review} d={d} kind="enrolled">
      <T y={56} size={25} center className="a-up pl-[8px] font-bold text-mint" style={delay(0.45)}>
        입학을 축하합니다!
      </T>
      <PaperRow y={at ? 117 : 141} left="체험생" right={`${d.school} ${d.name}`} d={0.6} />
      {at && <PaperRow y={165} left="일시" right={stamp(at)} d={0.72} />}
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

export function Grades({ active, nav, state, route }) {
  const v = view(state);
  const review = isReview(route?.params);
  const next = () => nav.replace("diploma", undefined, "fade");
  const ok = !!v?.progress.graduated;
  useGuard(ok, nav, active);
  useAutoAdvance(next, 4600, review);
  if (!ok) return null;
  const { d, progress } = v;
  // 들은 과목을 필수부터, 학년 순서로 적는다. 종이에 다 들어가지 않으면 "외 N과목" 줄까지 7줄로 줄인다(서명 줄과 붙지 않게).
  const taken = [...progress.taken].sort((a, b) => b.required - a.required || a.year - b.year);
  const { shown, more } = transcriptRows(taken);
  const average = averagePoint(taken.map((course) => course.record.grade));
  const perfect = taken.every((course) => course.record.grade === "A+" || course.record.grade === PASS);
  return (
    <CertificateShell onBack={review ? nav.back : () => nav.reset(["home"])} onNext={next} review={review} d={d} kind="grades">
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
          {more > 0 && <li className="text-[10px] leading-[16px] text-gray">{`외 ${more}과목`}</li>}
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

export function Diploma({ active, nav, state, route }) {
  const v = view(state);
  const review = isReview(route?.params);
  const next = () => nav.replace("graduation", undefined, "fade");
  const ok = !!v?.progress.graduated;
  useGuard(ok, nav, active);
  useAutoAdvance(next, 4200, review);
  if (!ok) return null;
  const { d } = v;
  return (
    <CertificateShell onBack={review ? nav.back : () => nav.reset(["home"])} onNext={next} review={review} d={d} kind="diploma">
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
  const { d, progress } = v;
  // 학년 안내: 바로 넘어간 학년이 있으면 그 사실과 처음 들을 학년 기준(학과 홈과 같은 계산, #40).
  const guide = welcomeGuide(d, progress);
  // 화면이 낮으면 캐릭터를 줄여서(최대 150) 그 아래 인사와 학년 안내가 버튼에 가려지지 않게 올린다.
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
          {guide.skipped ? (
            // 넘어간 학년 · 처음 들을 학년 · 안내 한 줄을 같은 115px 카드 안에 세 줄로 놓는다.
            <>
              <T y={17} size={13} lh={18} center clip={360} className="font-semibold text-mint-deep">
                {guide.skipped}
              </T>
              <T y={43} size={16.5} center clip={360} className="font-bold text-ink-2">
                {guide.title}
              </T>
              <T y={77} size={13.5} lh={20} center clip={360} className="text-ink-3">
                {guide.body}
              </T>
            </>
          ) : (
            <>
              <T y={27} size={16.5} center clip={360} className="font-bold text-ink-2">
                {guide.title}
              </T>
              <T y={62.5} size={13.5} lh={20} center className="text-ink-3">
                {guide.body}
              </T>
            </>
          )}
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
