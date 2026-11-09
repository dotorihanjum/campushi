import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SCREENS } from "./screens.jsx";
import { STORAGE_KEY, loadState, refreshCatalog } from "./model.js";
import { getDepartments } from "./api.js";

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
const SETTLED = { enrolled: "welcome", grades: "graduation", diploma: "graduation" };

let keySeed = 1;
const make = (name, params) => ({ name, params, key: keySeed++ });

function initialStack(state) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STACK_KEY));
    if (Array.isArray(saved) && saved.length && saved.every((r) => r && r.name in SCREENS))
      return saved.map((r, i) =>
        make(i === saved.length - 1 ? SETTLED[r.name] || r.name : r.name, r.params || undefined),
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
  const [state, setState] = useState(() => loadState(window.localStorage));
  const [stack, setStack] = useState(() => initialStack(state));
  const [ghosts, setGhosts] = useState([]);
  const [anim, setAnim] = useState({});
  const [busy, setBusy] = useState(false);
  // 학과 데이터 받기: loading | ready | error. 저장해 둔 데이터가 있으면 받는 동안·받지 못해도 그것으로 진행한다.
  const [load, setLoad] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const stackRef = useRef(stack);
  stackRef.current = stack;
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 저장 공간을 쓸 수 없으면 이번 방문 동안만 기록이 유지된다.
    }
  }, [state]);
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
      reset: (names, tr = "fade") => {
        const cur = stackRef.current;
        const prev = cur[cur.length - 1];
        run(names.map((n) => make(n)), ENTER[tr], null, EXIT[tr], prev);
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
    <main ref={stage} className="stage relative flex w-full items-center justify-center bg-white min-[520px]:bg-[#e9ecef]">
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
                  active={!ghost && route.key === top.key}
                />
              </div>
            );
          })}
          {busy && <div className="absolute inset-0 z-50" />}
        </div>
      </div>
    </main>
  );
}
