import React, { useEffect, useId, useRef, useState } from "react";
import { confetti, icon, img } from "./assets.js";
import { avatarColor, logoImage, schoolInitials } from "./logos.js";

/**
 * 학교 로고. 로고 이미지가 있으면 이미지를, 아니면(또는 이미지를 불러오지 못하면) 원 안에 학교 이름 앞 두 글자를 쓴
 * 텍스트 아바타를 그린다. 상자 크기는 부르는 쪽이 정하고, size는 아바타 원의 지름이다.
 * kind가 seal이면 증명서 도장 이미지를 쓰고, 도장은 꾸밈이라 화면 낭독기에 읽히지 않게 둔다.
 */
export function SchoolLogo({ school, kind = "logo", size = 64, className = "", style }) {
  const name = logoImage(school, kind);
  const src = name ? img[name] : null;
  // 불러오지 못한 이미지 주소. 학교가 바뀌면 다시 시도한다.
  const [failed, setFailed] = useState(null);
  if (src && failed !== src)
    return (
      <img
        src={src}
        alt={kind === "seal" ? "" : `${school} 로고`}
        onError={() => setFailed(src)}
        className={`h-full w-full object-contain ${className}`}
        style={style}
      />
    );
  return (
    <div aria-hidden="true" className={`flex h-full w-full items-center justify-center ${className}`} style={style}>
      <div
        className="flex items-center justify-center rounded-full border border-black/5 font-bold leading-none tracking-[-0.04em] text-ink-2"
        style={{ width: size, height: size, background: avatarColor(school), fontSize: Math.round(size * 0.34) }}
      >
        {schoolInitials(school)}
      </div>
    </div>
  );
}

/** 뽑아낸 아이콘을 CSS 마스크로 그려 색을 입힐 수 있게 한다. */
export function Mask({ src, w, h, color = "currentColor", className = "", style }) {
  return (
    <span
      aria-hidden
      className={`block shrink-0 ${className}`}
      style={{
        width: w,
        height: h,
        background: color,
        // 작은 SVG는 빌드할 때 data: 주소로 들어가 공백·괄호가 있을 수 있어 따옴표로 감싼다.
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        ...style,
      }}
    />
  );
}

const ARTBOARD_H = 874;
const GLYPH_OFFSET = 0.06;

/**
 * 시안의 글자 윗선(논리 px)에 맞춰 놓는 글. clip을 주면 그 폭을 넘는 글은 말줄임표로 자른다
 * (학교·학과 이름처럼 길이를 알 수 없는 글에 쓴다).
 */
export function T({ y, size, lh, left, right, center, clip, className = "", style, children }) {
  const lineHeight = lh ?? Math.round(size * 1.4);
  const top = y - (lineHeight - size) / 2 - size * GLYPH_OFFSET;
  const clipped = clip
    ? { maxWidth: clip, overflow: "hidden", textOverflow: "ellipsis" }
    : undefined;
  return (
    <div
      className={`absolute whitespace-pre ${center ? "left-0 right-0 text-center" : ""} ${center && clip ? "mx-auto" : ""} ${className}`}
      style={{ top, left, right, fontSize: size, lineHeight: `${lineHeight}px`, ...clipped, ...style }}
    >
      {children}
    </div>
  );
}

/**
 * 화면 하나. 아트보드 높이는 기기마다 달라서(App.jsx) 내용을 세 군데에 나눠 붙인다.
 * - children: 위쪽 기준. 시안의 좌표 그대로 놓는다. h(내용이 끝나는 y)를 주면 화면이 모자랄 때 세로로 스크롤된다.
 *   h는 숫자(px)나 CSS 길이 식("725px - 10px")이다.
 * - footer: 아래쪽 기준. 시안의 좌표 그대로 주면 화면 아래 끝에 붙는다. foot은 그 영역이 시작하는 y다.
 * - 가운데 기준으로 둘 것은 Center로 감싼다.
 */
export function Screen({ children, footer, foot = 740, veil = true, h, resetOn, bg = "#fff", className = "", overlay }) {
  const scroller = useRef(null);
  useEffect(() => {
    scroller.current.scrollTop = 0;
  }, [resetOn]);
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} style={{ background: bg }}>
      <div ref={scroller} className="no-scrollbar absolute inset-0 overflow-y-auto overflow-x-hidden">
        <div
          className="relative min-h-full"
          style={h ? { height: `calc(${typeof h === "number" ? `${h}px` : h} + ${footer ? ARTBOARD_H - foot : 0}px - (var(--tt) + var(--bt)) * 1px)` } : undefined}
        >
          <div className="absolute inset-x-0 bottom-0" style={{ top: "calc(var(--tt) * -1px)" }}>
            {children}
          </div>
        </div>
      </div>
      {footer && (
        <div
          className="pointer-events-none absolute inset-x-0 *:pointer-events-auto"
          style={{ height: ARTBOARD_H, bottom: "calc(var(--bt) * -1px)" }}
        >
          {/* 스크롤된 내용이 아래 버튼 뒤로 비치지 않게 가린다. */}
          {veil && (
            <div
              className="absolute inset-x-0 bottom-0"
              style={{ top: foot, background: `linear-gradient(transparent, ${veil === true ? bg : veil} 12px)` }}
            />
          )}
          {footer}
        </div>
      )}
      {/* 화면 전체를 덮는 것(확인 창, 알림). 스크롤과 상관없이 보이는 영역에 놓인다. */}
      {overlay}
    </div>
  );
}

/**
 * 확인 창. 화면을 어둡게 덮고 가운데에 띄운다. 열리면 첫 버튼에 초점을 두고, Tab은 창 안에서만 돌며,
 * Esc나 바깥을 누르면 닫힌다. 닫히면 열기 전에 초점이 있던 곳으로 돌려준다.
 */
export function Dialog({ title, children, actions, onClose }) {
  const box = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement;
    box.current.querySelector("button:not([disabled])")?.focus({ preventScroll: true });
    return () => opener?.focus?.({ preventScroll: true });
  }, []);
  const keys = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key !== "Tab") return;
    const buttons = [...box.current.querySelectorAll("button:not([disabled])")];
    const at = buttons.indexOf(document.activeElement);
    const next = (at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
    e.preventDefault();
    buttons[next]?.focus();
  };
  return (
    <div className="a-fade absolute inset-0 z-40 flex items-center justify-center bg-[rgba(32,43,60,0.42)] px-[24px]" onClick={onClose}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={keys}
        onClick={(e) => e.stopPropagation()}
        className="a-pop w-full max-w-[354px] rounded-[20px] bg-white px-[22px] pb-[18px] pt-[24px] shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
      >
        <h2 id={titleId} className="text-[18px] font-bold leading-[26px] text-ink-2" style={{ wordBreak: "keep-all" }}>
          {title}
        </h2>
        <div className="mt-[8px] text-[14px] leading-[22px] text-ink-3" style={{ wordBreak: "keep-all" }}>
          {children}
        </div>
        <div className="mt-[20px] grid gap-[8px]">{actions}</div>
      </div>
    </div>
  );
}

/** 잠깐 떴다 사라지는 알림. 스크린 리더도 읽는다. */
export function Toast({ children }) {
  return (
    <div role="status" className="pointer-events-none absolute inset-x-[20px] z-50 flex justify-center" style={{ bottom: "calc(150px - var(--bt) * 1px)" }}>
      {children && (
        <p className="a-up rounded-full bg-navy/90 px-[18px] py-[10px] text-center text-[13.5px] font-medium leading-[20px] text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          {children}
        </p>
      )}
    </div>
  );
}

/** 화면 가운데를 기준으로 놓는 내용(마스코트, 증명서). 안에는 시안의 좌표를 그대로 쓴다. */
export function Center({ children }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-x-0 top-1/2" style={{ height: ARTBOARD_H, marginTop: -ARTBOARD_H / 2 }}>
        {children}
      </div>
    </div>
  );
}

export function BackButton({ onClick, color = "#949494" }) {
  return (
    <button
      aria-label="뒤로"
      onClick={onClick}
      className="pressable absolute left-[17px] top-[51px] z-20 flex h-[40px] w-[40px] items-center justify-center"
    >
      <Mask src={icon.back} w={16} h={24} color={color} />
    </button>
  );
}

export function Header({ title, count, onBack, backColor }) {
  return (
    <>
      {onBack && <BackButton onClick={onBack} color={backColor} />}
      {title && (
        <div className="absolute left-[70px] right-[70px] top-[60px] overflow-hidden text-ellipsis whitespace-nowrap text-center text-[14px] leading-[22px] text-mint">
          {title}
        </div>
      )}
      {count && (
        <div className="absolute right-[35px] top-[60px] text-[14px] leading-[22px] text-mint tabular-nums">
          {count}
        </div>
      )}
    </>
  );
}

export function OutlineButton({ children, onClick, top = 756, className = "", style }) {
  return (
    <button
      onClick={onClick}
      className={`pressable absolute left-[20px] z-10 flex h-[68px] w-[362px] items-center justify-center rounded-[18px] border border-mint bg-white px-[16px] text-[20px] font-medium text-mint active:bg-mint-soft ${className}`}
      style={{ top, ...style }}
    >
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{children}</span>
    </button>
  );
}

/** 민트색이 꽉 찬 버튼(홈의 시작 버튼과 같은 모양). 화면 아래의 주 행동에 쓴다. */
export function FilledButton({ children, onClick, disabled, top = 752, className = "", style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`pressable absolute left-[20px] z-10 flex h-[56.5px] w-[362px] items-center justify-center rounded-[14px] bg-mint px-[16px] text-[17.5px] font-semibold text-white active:brightness-95 disabled:cursor-default disabled:opacity-40 ${className}`}
      style={{ top, ...style }}
    >
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{children}</span>
    </button>
  );
}

/** 모서리가 접힌 종이. 입학증·성적표·졸업증명서에 쓴다. */
export function Paper({ children, className = "", style }) {
  return (
    <div
      className={`absolute left-[64px] top-[254px] h-[365px] w-[273px] rounded-[8px] bg-white ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function PaperFold({ src, delay: wait = 0.35 }) {
  return (
    <img
      src={src}
      alt=""
      className="absolute left-0 top-0 h-[58px] w-[58px] origin-top-left"
      style={{ animation: `fold-in 0.6s cubic-bezier(0.34,1.56,0.64,1) ${wait}s both` }}
    />
  );
}

/** 색종이가 마스코트에서 튀어나와 제자리로 날아간 뒤 살랑거린다. */
export function Confetti({ originX = 201, originY = 200, delay: wait = 0.15 }) {
  return (
    <>
      {confetti.map((p, i) => {
        const dx = originX - (p.x + p.w / 2);
        const dy = originY - (p.y + p.h / 2);
        return (
          <span
            key={i}
            className="pointer-events-none absolute z-10"
            style={{
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
              animation: `confetti 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${wait + i * 0.025}s both`,
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
              "--r": `${(i % 2 ? 1 : -1) * 160}deg`,
            }}
          >
            <img
              src={p.src}
              alt=""
              className="loop block h-full w-full"
              style={{ animation: `drift ${2.6 + (i % 3) * 0.5}s ease-in-out ${1.1 + i * 0.12}s infinite` }}
            />
          </span>
        );
      })}
    </>
  );
}

export function delay(s) {
  return { animationDelay: `${s}s` };
}

// 이만큼(px) 넘게 움직여야 끌기로 본다. 그보다 적게 움직이고 떼면 누르기(클릭)다.
const PAN_SLOP = 5;
// 화살표 키 한 번에 미는 거리(px).
const PAN_STEP = 48;
// 가장 크게 확대하는 배율. 가장 작게는 내용이 틀을 빈틈없이 덮는 배율까지(1보다 크지 않게) 줄인다.
const ZOOM_MAX = 2.5;
// 확대·축소 버튼과 +, - 키 한 번에 바꾸는 배율(곱한다).
const ZOOM_STEP = 1.25;

const clampPan = (v, frame, content) => Math.min(0, Math.max(frame - content, v));
const clampZoom = (z, min) => Math.min(ZOOM_MAX, Math.max(min, z));

/**
 * 화면 안에 고정된 틀 안에서 그보다 큰 내용(width×height)을 끌어 보고 확대·축소하는 상자. 틀은 움직이지 않고 내용만
 * transform으로 옮기고 키우며, 내용 끝이 틀 가장자리를 넘어 빈 곳이 보이지 않게 막는다. 마우스·터치는 포인터 이벤트로 함께
 * 받고, 틀 안에서 끄는 동안에는 페이지가 같이 스크롤되지 않는다(touch-action: none). PAN_SLOP 넘게 끈 뒤에 뗀 것은 안쪽 버튼의
 * 클릭으로 치지 않는다.
 * 확대·축소: 두 손가락 벌리기·오므리기, Ctrl+휠(노트북 터치패드 핀치), 틀의 +·- 키, 오른쪽 아래 막대(−·+ 버튼과 끌 수 있는 손잡이).
 * focus: 처음(그리고 끌기 전 틀 크기가 바뀔 때) 틀 가운데에 둘 내용 안의 점 [x, y].
 * overlay: 틀 위에 고정해 둘 것(끌기·확대와 함께 움직이지 않는다. 예: 지도 출처 표기).
 * 키보드로 안쪽 버튼에 포커스가 가면 그 버튼이 보이게 밀고, 틀에 포커스가 있으면 화살표 키로 민다.
 */
export function PanView({ width, height, focus, label, className = "", style, overlay, children }) {
  const frame = useRef(null);
  const canvas = useRef(null);
  const pos = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const minRef = useRef(1);
  const size = useRef({ w: 0, h: 0 });
  // 지금 틀에 닿아 있는 포인터(id → 화면 좌표). 두 개면 확대·축소, 하나면 끌기다.
  const points = useRef(new Map());
  const drag = useRef(null);
  const moved = useRef(false);
  const touched = useRef(false);
  const raf = useRef(0);
  // 아래 확대 막대에 보여 줄 배율과 가장 작은 배율.
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [fx, fy] = focus;

  const paint = () => {
    raf.current = 0;
    if (canvas.current) {
      canvas.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) scale(${zoomRef.current})`;
    }
  };
  const moveTo = (x, y, now = false) => {
    const z = zoomRef.current;
    pos.current = { x: clampPan(x, size.current.w, width * z), y: clampPan(y, size.current.h, height * z) };
    if (now) {
      window.cancelAnimationFrame(raf.current);
      paint();
    } else if (!raf.current) raf.current = window.requestAnimationFrame(paint);
  };
  // 확대된 내용 안의 점(px, 배율 적용)을 틀 가운데로.
  const center = (x, y, now) => moveTo(size.current.w / 2 - x, size.current.h / 2 - y, now);
  // 배율을 z로 바꾸되 틀 안의 점 (px, py)에 있던 내용은 그 자리에 둔다.
  const zoomAt = (z, px, py, now = false) => {
    const next = clampZoom(z, minRef.current);
    const k = next / zoomRef.current;
    zoomRef.current = next;
    touched.current = true;
    moveTo(px - (px - pos.current.x) * k, py - (py - pos.current.y) * k, now);
    setZoom(next);
  };
  const zoomCenter = (z) => zoomAt(z, size.current.w / 2, size.current.h / 2, true);

  // 틀 크기(화면 높이에 따라 바뀐다)를 재고, 아직 끌지 않았으면 focus를 가운데 두고, 끌었으면 범위 안으로만 당긴다.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => {
      size.current = { w: el.clientWidth, h: el.clientHeight };
      const min = Math.min(1, Math.max(size.current.w / width, size.current.h / height));
      minRef.current = min;
      setMinZoom(min);
      if (zoomRef.current < min) {
        zoomRef.current = min;
        setZoom(min);
      }
      if (touched.current) moveTo(pos.current.x, pos.current.y, true);
      else center(fx * zoomRef.current, fy * zoomRef.current, true);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // Ctrl+휠(터치패드 핀치 포함)은 페이지 확대 대신 지도를 확대한다. 그냥 휠은 페이지 스크롤로 둔다.
    const wheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const s = scaleOf(el);
      const box = el.getBoundingClientRect();
      zoomAt(zoomRef.current * Math.exp(-e.deltaY / 400), (e.clientX - box.left) / s - el.clientLeft, (e.clientY - box.top) / s - el.clientTop);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      observer.disconnect();
      el.removeEventListener("wheel", wheel);
      window.cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
    // moveTo·center·zoomAt은 ref만 쓴다.
  }, [fx, fy, width, height]);

  // 앱 화면 전체가 창 크기에 맞게 확대·축소되어 있으므로, 포인터가 움직인 화면 px를 틀 안의 px로 바꾼다.
  const scaleOf = (el) => el.getBoundingClientRect().width / el.offsetWidth || 1;
  // 화면 좌표 → 틀 안의 좌표.
  const local = (x, y) => {
    const el = frame.current;
    const s = scaleOf(el);
    const box = el.getBoundingClientRect();
    return [(x - box.left) / s - el.clientLeft, (y - box.top) / s - el.clientTop];
  };
  // 남은 포인터 하나로 끌기를 (다시) 시작한다.
  const startDrag = (id, type, el) => {
    const p = points.current.get(id);
    drag.current = { id, type, sx: p.x, sy: p.y, x: pos.current.x, y: pos.current.y, scale: scaleOf(el) };
  };
  const startPinch = () => {
    const [a, b] = [...points.current.values()];
    const [mx, my] = local((a.x + b.x) / 2, (a.y + b.y) / 2);
    drag.current = { type: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: zoomRef.current, cx: (mx - pos.current.x) / zoomRef.current, cy: (my - pos.current.y) / zoomRef.current };
  };

  const down = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType === "mouse") points.current.clear();
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (points.current.size === 2 && e.pointerType !== "mouse") {
      // 두 번째 손가락이 닿으면 확대·축소로 바꾼다. 이 손가락들을 뗄 때 오는 클릭은 버린다.
      moved.current = true;
      touched.current = true;
      for (const id of points.current.keys()) e.currentTarget.setPointerCapture?.(id);
      startPinch();
      return;
    }
    if (points.current.size > 2) return;
    // 끄는 동안만 내용을 따로 된 층으로 올려 부드럽게 옮기고, 손을 떼면 내린다(올려 둔 채 확대하면 그림이 흐려진다).
    if (canvas.current) canvas.current.style.willChange = "transform";
    moved.current = false;
    startDrag(e.pointerId, e.pointerType, e.currentTarget);
  };
  const move = (e) => {
    if (!points.current.has(e.pointerId)) return;
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (!d) return;
    if (d.type === "pinch") {
      if (points.current.size < 2) return;
      const [a, b] = [...points.current.values()];
      const [mx, my] = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const next = clampZoom((d.z * Math.hypot(a.x - b.x, a.y - b.y)) / d.d, minRef.current);
      zoomRef.current = next;
      moveTo(mx - d.cx * next, my - d.cy * next);
      setZoom(next);
      return;
    }
    if (d.id !== e.pointerId) return;
    const dx = (e.clientX - d.sx) / d.scale;
    const dy = (e.clientY - d.sy) / d.scale;
    if (!moved.current) {
      if (Math.hypot(dx, dy) <= PAN_SLOP) return;
      // 끌기가 시작된 뒤에만 포인터를 붙잡는다(누르기만 했을 때는 클릭이 원래 버튼으로 가야 한다).
      moved.current = true;
      touched.current = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    moveTo(d.x + dx, d.y + dy);
  };
  // 터치는 처음 닿은 안쪽 요소가 포인터를 붙잡고 있다가 틀이 가져오면 그 요소에서 lostpointercapture가 올라오므로,
  // 틀 자신이 놓친 경우만 끌기를 끝낸다.
  const up = (e) => {
    if (!points.current.delete(e.pointerId)) return;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const left = points.current.size;
    if (left === 0) {
      drag.current = null;
      if (canvas.current) canvas.current.style.willChange = "";
    }
    // 확대하던 두 손가락 중 하나를 떼면 남은 손가락으로 이어서 끈다.
    else if (left === 1 && drag.current?.type === "pinch") {
      const [id] = points.current.keys();
      startDrag(id, "touch", e.currentTarget);
    } else if (left === 2) startPinch();
  };
  // 끌고 난 뒤 따라오는 클릭은 버리고, 다음 누르기부터 다시 받는다.
  const clickCapture = (e) => {
    if (!moved.current) return;
    moved.current = false;
    e.preventDefault();
    e.stopPropagation();
  };
  // 키보드로 안쪽 버튼에 오면 그 버튼이 틀 안에 보이게 민다(브라우저가 틀을 스크롤해 버린 것도 되돌린다).
  const focusIn = (e) => {
    const el = frame.current;
    el.scrollLeft = 0;
    el.scrollTop = 0;
    if (e.target === el || !canvas.current || drag.current) return;
    const scale = scaleOf(el);
    const box = e.target.getBoundingClientRect();
    const view = el.getBoundingClientRect();
    const left = (box.left - view.left) / scale - el.clientLeft;
    const top = (box.top - view.top) / scale - el.clientTop;
    const right = left + box.width / scale;
    const bottom = top + box.height / scale;
    if (left >= 0 && top >= 0 && right <= size.current.w && bottom <= size.current.h) return;
    touched.current = true;
    center((left + right) / 2 - pos.current.x, (top + bottom) / 2 - pos.current.y, true);
  };
  const key = (e) => {
    if (e.target !== frame.current) return;
    if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomCenter(zoomRef.current * (e.key === "+" || e.key === "=" ? ZOOM_STEP : 1 / ZOOM_STEP));
      return;
    }
    const step = { ArrowLeft: [PAN_STEP, 0], ArrowRight: [-PAN_STEP, 0], ArrowUp: [0, PAN_STEP], ArrowDown: [0, -PAN_STEP] }[e.key];
    if (!step) return;
    e.preventDefault();
    touched.current = true;
    moveTo(pos.current.x + step[0], pos.current.y + step[1]);
  };

  // 확대 막대는 배율을 로그 눈금으로 보여 준다(가장 작게 0 ~ 가장 크게 100). 줄일 수 없는 틀이면 0 ~ 100이 1 ~ ZOOM_MAX다.
  const span = Math.log(ZOOM_MAX / minZoom) || 1;
  const level = Math.round((Math.log(zoom / minZoom) / span) * 100);
  const fromLevel = (v) => minZoom * Math.exp((v / 100) * span);
  const zoomButton = "pressable flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-[18px] font-semibold leading-none text-mint-deep disabled:text-[#c4c4c4] focus-visible:outline-2 focus-visible:outline-mint-deep";

  return (
    <div className="relative h-full w-full">
      <div
        ref={frame}
        role="region"
        aria-label={label}
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={(e) => e.target === e.currentTarget && up(e)}
        onClickCapture={clickCapture}
        onFocus={focusIn}
        onKeyDown={key}
        onDragStart={(e) => e.preventDefault()}
        className={`relative cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing ${className}`}
        style={style}
      >
        <div ref={canvas} className="absolute left-0 top-0 origin-top-left" style={{ width, height }}>
          {children}
        </div>
      </div>
      {overlay}
      <div className="absolute bottom-[8px] right-[8px] flex items-center rounded-full bg-white/90 px-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
        <button type="button" aria-label="지도 축소" className={zoomButton} disabled={level <= 0} onClick={() => zoomCenter(zoomRef.current / ZOOM_STEP)}>
          −
        </button>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={level}
          onChange={(e) => zoomCenter(fromLevel(Number(e.target.value)))}
          aria-label="지도 확대 정도"
          aria-valuetext={`${Math.round(zoom * 100)}%`}
          className="zoom-range w-[84px]"
        />
        <button type="button" aria-label="지도 확대" className={zoomButton} disabled={level >= 100} onClick={() => zoomCenter(zoomRef.current * ZOOM_STEP)}>
          +
        </button>
      </div>
    </div>
  );
}
