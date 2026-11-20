import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SCREENS } from "./screens/index.js";
import { STORAGE_KEY, loadState, refreshCatalog } from "./model.js";
import { getDepartments } from "./api.js";
import { openStorage, storageNotice, writeStorage } from "./storage.js";
import { useLogin } from "./useLogin.js";
import { authReturn } from "./login.js";
import { isReview } from "./certificates.js";

// 화면은 402×874 아트보드에 맞춰 그리고, 창 크기에 맞게 통째로 줄이거나 늘린다.
const W = 402;
const H = 874;
// 휴대폰에서 아트보드가 이보다 낮아지면 폭을 채우지 않고 높이에 맞춰 줄인다.
const MIN_H = 560;
// 시안에서 기기 상태바와 홈 인디케이터 자리였던 위아래 여백. 높이가 모자라면 이만큼까지 먼저 줄인다.
const TRIM_TOP = 32;
const TRIM_BOTTOM = 28;
const DURATION = 520;
const STACK_KEY = "campushi-stack-v2";

const ENTER = { push: "tr-push-in", fade: "tr-fade-in", rise: "tr-rise-in" };
const EXIT = { push: "tr-push-out", fade: "tr-fade-out", rise: "tr-fade-out" };
// 잠깐 보여주고 넘어가는 화면. 새로고침으로 돌아왔을 때는 그다음 화면을 보여준다.
// 체험 탭에서 다시 보기로 연 증명서(#23)는 넘어가지 않으므로 그 화면 그대로 둔다.
const SETTLED = { enrolled: "welcome", grades: "graduation", diploma: "graduation" };

let keySeed = 1;
const make = (name, params) => ({ name, params, key: keySeed++ });

function initialStack(state) {
  const returned = authReturn(location.search);
  if (returned.result) return [make(returned.view)];
  try {
    const saved = JSON.parse(sessionStorage.getItem(STACK_KEY));
    if (Array.isArray(saved) && saved.length && saved.every((r) => r && r.name in SCREENS))
      return saved.map((r, i) =>
        make(i === saved.length - 1 && !isReview(r.params) ? SETTLED[r.name] || r.name : r.name, r.params || undefined),
      );
  } catch {
    // 저장된 화면 기록을 읽을 수 없으면 처음부터 시작한다.
  }
  return [make(!state.onboarded ? "splash" : state.campus ? "home" : "school")];
}

// 폭이 좁은 화면(휴대폰)에서는 폭을 꽉 채우고 아트보드의 높이를 화면에 맞춘다. 주소창 때문에 화면이
// 시안보다 납작해도 양옆이 비지 않는다. 넓은 화면에서는 시안 폭 그대로 가운데에 두고, 높이가 모자라면
// 휴대폰처럼 아트보드를 낮춘다(MIN_H까지). 가로로 돌린 휴대폰에서 화면 전체가 반 크기로 줄어 글씨를 못 읽던 문제.
function fit(vw, vh) {
  // 아직 그려지지 않은(크기가 0인) 영역에서는 시안 크기 그대로 둔다(0으로 나누면 높이가 NaN이 된다).
  if (!vw || !vh) return { scale: 1, height: H };
  if (vw >= 520) {
    const scale = Math.min(1, vw / W, vh / MIN_H);
    return { scale, height: Math.min(H, vh / scale) };
  }
  const scale = Math.min(vw / W, vh / MIN_H);
  return { scale, height: vh / scale };
}

// 가로로 긴 낮은 화면(가로로 돌린 휴대폰)이고 아트보드 옆에 글을 놓을 자리가 있으면 세로로 돌리라고 안내한다.
const ASIDE_W = 200;
const showsRotateHint = (vw, vh, scale) => vw > vh && vh < 600 && (vw - W * scale) / 2 >= ASIDE_W + 16;

// 창 크기가 아니라 실제로 그려지는 영역(main)을 재서 맞춘다. 모바일 브라우저는 주소창·도구 막대 때문에
// 창 높이와 보이는 영역이 다를 수 있다.
function useFit(ref) {
  const [box, setBox] = useState(() => fit(window.innerWidth, window.innerHeight));
  useLayoutEffect(() => {
    const el = ref.current;
    const update = () =>
      setBox((cur) => {
        const next = fit(el.clientWidth, el.clientHeight);
        next.hint = showsRotateHint(el.clientWidth, el.clientHeight, next.scale);
        return next.scale === cur.scale && next.height === cur.height && next.hint === cur.hint ? cur : next;
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return box;
}

export default function App() {
  const auth = useLogin();
  // 쿠키·사이트 데이터를 막은 브라우저에서는 localStorage를 읽기만 해도 예외가 나므로, 열지 못하면 빈 상태로 시작한다.
  const [storage] = useState(() => openStorage(() => window.localStorage));
  const [state, setState] = useState(() => loadState(storage));
  // 저장 실패 안내: hidden | shown | closed. 닫은 것은 메모리에만 둔다(저장소가 막혀 있으므로).
  const [notice, setNotice] = useState("hidden");
  const [stack, setStack] = useState(() => initialStack(state));
  const [ghosts, setGhosts] = useState([]);
  const [anim, setAnim] = useState({});
  const [busy, setBusy] = useState(false);
  // 학과 데이터 받기: loading | ready | error. 저장해 둔 데이터가 있으면 받는 동안·받지 못해도 그것으로 진행한다.
  const [load, setLoad] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  // 지금 보이는(맨 위) 화면. 저장 안내를 닫은 뒤 키보드 포커스를 이 화면으로 옮긴다.
  const screen = useRef(null);
  const closeNotice = () => {
    setNotice("closed");
    focusScreen(screen.current);
  };
  const stage = useRef(null);
  const { scale, height, hint } = useFit(stage);
  const short = Math.max(0, H - height);
  const trimBottom = Math.min(short, TRIM_BOTTOM);
  const trimTop = Math.min(short - trimBottom, TRIM_TOP);
  // 위아래 여백을 줄이고도 시안보다 모자란 높이. 화면이 이만큼 내용을 줄이거나 스크롤로 보여준다.
  const cut = short - trimBottom - trimTop;

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    getDepartments(controller.signal).then(
      (raws) => {
        setState((s) => refreshCatalog(s, raws));
        setLoad({ status: "ready" });
      },
      (error) => {
        if (!controller.signal.aborted) setLoad({ status: "error", message: error.message });
      },
    );
    return () => controller.abort();
  }, [attempt]);
  const catalog = useMemo(() => ({ ...load, retry: () => setAttempt((n) => n + 1) }), [load]);

  // 저장 공간을 쓸 수 없으면 이번 방문 동안만 기록이 유지되므로, 화면 위쪽에 알린다(storage.js).
  useEffect(() => {
    const saved = writeStorage(storage, STORAGE_KEY, JSON.stringify(state));
    setNotice((n) => storageNotice(n, saved));
  }, [storage, state]);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        STACK_KEY,
        JSON.stringify(stack.map(({ name, params }) => ({ name, params }))),
      );
    } catch {
      // 화면 기록을 저장하지 못해도 사용에는 지장이 없다.
    }
  }, [stack]);

  const run = useCallback((next, enter, exitKey, exitCls, ghost) => {
    const top = next[next.length - 1];
    const map = { [top.key]: enter };
    if (exitKey !== null) map[exitKey] = exitCls;
    setAnim(map);
    if (ghost) setGhosts((g) => [...g, { route: ghost, cls: exitCls }]);
    setStack(next);
    setBusy(true);
    window.setTimeout(() => {
      setAnim({});
      setBusy(false);
      if (ghost) setGhosts((g) => g.filter((x) => x.route.key !== ghost.key));
    }, DURATION);
  }, []);

  const nav = useMemo(
    () => ({
      push: (name, params, tr = "push") => {
        const cur = stackRef.current;
        const prev = cur[cur.length - 1];
        run([...cur, make(name, params)], ENTER[tr], prev.key, EXIT[tr], null);
      },
      replace: (name, params, tr = "fade") => {
        const cur = stackRef.current;
        const prev = cur[cur.length - 1];
        run([...cur.slice(0, -1), make(name, params)], ENTER[tr], null, EXIT[tr], prev);
      },
      // names: 화면 이름, 또는 [화면 이름, params].
      reset: (names, tr = "fade") => {
        const cur = stackRef.current;
        const prev = cur[cur.length - 1];
        run(names.map((n) => (Array.isArray(n) ? make(n[0], n[1]) : make(n))), ENTER[tr], null, EXIT[tr], prev);
      },
      back: () => {
        const cur = stackRef.current;
        if (cur.length <= 1) return;
        const prev = cur[cur.length - 1];
        run(cur.slice(0, -1), "tr-pop-in", null, "tr-pop-out", prev);
      },
    }),
    [run],
  );

  // 브라우저의 뒤로 가기를 앱의 이전 화면으로 연결한다. 더 돌아갈 화면이 없으면 브라우저에 맡긴다.
  useEffect(() => {
    if (!history.state?.hiCampus) history.pushState({ hiCampus: true }, "");
    const onPop = () => {
      if (stackRef.current.length <= 1) return;
      nav.back();
      history.pushState({ hiCampus: true }, "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [nav]);

  const top = stack[stack.length - 1];
  const layers = [
    ...stack.map((route) => ({
      route,
      cls: anim[route.key] ?? (route.key === top.key ? "" : "invisible pointer-events-none"),
      ghost: false,
    })),
    ...ghosts.map((g) => ({ route: g.route, cls: `${g.cls} pointer-events-none`, ghost: true })),
  ];

  return (
    <div className="stage flex flex-col">
      <StorageNotice shown={notice === "shown"} onClose={closeNotice} />
      <main ref={stage} className="relative flex min-h-0 w-full flex-1 items-center justify-center bg-white min-[520px]:bg-[#e9ecef]">
        {hint && (
          <aside
            className="absolute top-1/2 -translate-y-1/2 text-center text-[14px] leading-[21px] text-navy"
            style={{ width: ASIDE_W, left: `calc(25% - ${(W * scale) / 4 + ASIDE_W / 2}px)` }}
          >
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden className="mx-auto mb-[12px] text-mint-deep">
              <rect x="6" y="20" width="26" height="16" rx="3" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
              <rect x="22" y="6" width="16" height="26" rx="3" stroke="currentColor" strokeWidth="2.2" fill="#fff" />
              <path d="M8 15a10 10 0 0 1 10-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="m15 3 3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p style={{ wordBreak: "keep-all" }}>휴대폰을 세로로 돌리면 화면이 더 크게 보여요.</p>
          </aside>
        )}
        <div className="relative shrink-0 overflow-hidden" style={{ width: W * scale, height: height * scale }}>
          <div
            className="absolute left-0 top-0 overflow-hidden bg-white"
            style={{
              width: W,
              height,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
              "--vh": height,
              "--tt": trimTop,
              "--bt": trimBottom,
              "--cut": cut,
            }}
          >
            {layers.map(({ route, cls, ghost }) => {
              const S = SCREENS[route.name];
              return (
                <div
                  key={route.key}
                  ref={!ghost && route.key === top.key ? screen : undefined}
                  className={`absolute inset-0 ${cls}`}
                  style={ghost ? { zIndex: 3 } : undefined}
                  aria-hidden={route.key !== top.key}
                >
                  <S
                    nav={nav}
                    route={route}
                    state={state}
                    setState={setState}
                    catalog={catalog}
                  auth={auth}
                    active={!ghost && route.key === top.key}
                  />
                </div>
              );
            })}
            {busy && <div className="absolute inset-0 z-50" />}
          </div>
        </div>
      </main>
    </div>
  );
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 화면의 첫 번째 조작 가능한 요소(보이는 것)에 포커스를 둔다. 없으면 화면 영역 자체에 둔다(테두리 없이).
 * 키보드로 닫았으면 새 포커스에도 테두리가 보이고, 마우스로 닫았으면 브라우저의 :focus-visible 규칙상 테두리가 생기지 않는다.
 */
function focusScreen(el) {
  if (!el) return;
  const first = [...el.querySelectorAll(FOCUSABLE)].find(
    (node) => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden" && !node.closest('[aria-hidden="true"], [inert]'),
  );
  if (first) return first.focus();
  el.tabIndex = -1;
  el.style.outline = "none";
  el.focus();
}

/**
 * 저장 실패 안내. 아트보드 위에 겹치지 않고 그 위쪽 줄에 놓아, 안내가 보이는 동안은 아트보드가 그만큼 낮아진다
 * (휴대폰에서는 시안의 상태바 자리부터 줄어 화면 위쪽 버튼·탭바를 가리지 않는다).
 * role="status" 영역은 늘 두어, 안내가 들어오면 화면 낭독기가 읽는다.
 */
function StorageNotice({ shown, onClose }) {
  return (
    <div role="status" className="shrink-0">
      {shown && (
        <div className="border-b border-cream-line bg-cream">
          <div className="mx-auto flex max-w-[402px] items-center gap-[4px] py-[6px] pl-[16px] pr-[6px]">
            <p className="flex-1 text-[13.5px] font-medium leading-[20px] text-navy" style={{ wordBreak: "keep-all" }}>
              이 브라우저에서는 기록이 저장되지 않아요. 창을 닫으면 사라져요
            </p>
            <button
              type="button"
              aria-label="저장 안내 닫기"
              onClick={onClose}
              className="pressable flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[10px] text-navy focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-mint-deep"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
