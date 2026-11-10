import React, { useRef, useState } from "react";

// 끌어다 놓기로 이만큼(px) 넘게 움직여야 끌기로 본다. 그보다 적으면 누르기(블록 고르기)다.
const SLOP = 6;

/**
 * 듀오링고처럼 보기 블록을 빈칸으로 끌어다 놓는 문제. 블록을 누른 다음 빈칸을 눌러도 되고(키보드도 같다),
 * 채워진 빈칸을 누르면 블록이 보기로 돌아간다.
 *
 * rows: [{ id, text }] 빈칸 줄, blocks: [{ id, label }] 보기(보여 줄 순서), value: { 빈칸id: 블록id },
 * onPlace(블록id, 빈칸id | null), marks: { 빈칸id: true | false } 확인 뒤 표시(없으면 null), disabled: 다 맞힌 뒤.
 */
export function BlockBlanks({ theme, rows, blocks, value, onPlace, marks, disabled }) {
  const box = useRef(null);
  const drag = useRef(null);
  // 방금 끌기를 끝냈는지(뒤따라오는 클릭을 누르기로 치지 않는다).
  const dragged = useRef(false);
  const [picked, setPicked] = useState(null);
  const [ghost, setGhost] = useState(null);
  const placed = new Set(Object.values(value));
  const label = (id) => blocks.find((block) => block.id === id)?.label ?? "";

  // 앱 화면 전체가 창에 맞게 확대·축소되어 있어, 화면 좌표를 이 상자 안의 좌표로 바꾼다.
  const local = (x, y) => {
    const rect = box.current.getBoundingClientRect();
    const scale = rect.width / box.current.offsetWidth || 1;
    return { x: (x - rect.left) / scale, y: (y - rect.top) / scale };
  };
  const down = (e, block) => {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    dragged.current = false;
    drag.current = { block, sx: e.clientX, sy: e.clientY, moving: false, id: e.pointerId };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moving) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) <= SLOP) return;
      d.moving = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setPicked(null);
    }
    setGhost({ block: d.block, ...local(e.clientX, e.clientY) });
  };
  const up = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moving) return;
    dragged.current = true;
    setGhost(null);
    // 손을 뗀 곳의 빈칸에 넣고, 보기 칸이면 돌려보낸다. 다른 곳이면 그대로 둔다.
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const slot = under?.closest?.("[data-slot]")?.getAttribute("data-slot");
    if (slot) onPlace(d.block, slot);
    else if (under?.closest?.("[data-bank]")) onPlace(d.block, null);
  };
  const cancel = () => {
    drag.current = null;
    setGhost(null);
  };
  // 누르기: 블록을 고르거나 고른 것을 푼다.
  const tapBlock = (block) => {
    if (disabled || dragged.current) return;
    setPicked((p) => (p === block ? null : block));
  };
  const tapSlot = (slot) => {
    if (disabled || dragged.current) return;
    if (picked) {
      onPlace(picked, slot);
      setPicked(null);
    } else if (value[slot]) onPlace(value[slot], null);
  };
  const chip = (id, extra = {}) => ({
    className: `pressable inline-flex h-[40px] touch-none select-none items-center rounded-[12px] px-[14px] font-mono text-[15px] font-bold ${disabled ? "" : "cursor-grab"}`,
    style: {
      background: theme.panel,
      color: theme.text,
      border: `2px solid ${picked === id ? theme.accent : theme.line}`,
      boxShadow: `0 3px 0 ${theme.line}`,
      ...extra,
    },
  });

  return (
    <div ref={box} className="relative" onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}>
      <ol className="grid gap-[10px]">
        {rows.map((row, i) => {
          const inSlot = value[row.id];
          const mark = marks ? marks[row.id] : null;
          return (
            <li key={row.id} className="flex items-center gap-[10px]">
              <span className="min-w-0 flex-1 text-[14.5px] leading-[21px]" style={{ color: theme.text }}>
                <span className="mr-[4px] font-bold" style={{ color: theme.sub }}>{`#${i + 1}`}</span>
                {row.text}
              </span>
              <button
                type="button"
                data-slot={row.id}
                onClick={() => tapSlot(row.id)}
                aria-label={`${i + 1}번 빈칸: ${row.text}. ${inSlot ? `${label(inSlot)} 들어 있음${mark === true ? ", 맞음" : mark === false ? ", 틀림" : ""}` : "비어 있음"}`}
                className="pressable flex h-[46px] w-[118px] shrink-0 items-center justify-center rounded-[12px]"
                style={{
                  border: `2px ${inSlot ? "solid" : "dashed"} ${mark === true ? theme.accent : mark === false ? "#e06666" : picked ? theme.accent : theme.line}`,
                  background: mark === true ? theme.good : mark === false ? theme.bad : "transparent",
                }}
              >
                {inSlot ? (
                  <span
                    onPointerDown={(e) => down(e, inSlot)}
                    className="pointer-events-auto font-mono text-[15px] font-bold"
                    style={{ color: theme.text, touchAction: "none" }}
                  >
                    {label(inSlot)}
                  </span>
                ) : (
                  <span className="text-[12px]" style={{ color: theme.sub }}>
                    {picked ? "여기에 넣기" : "빈칸"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <div data-bank className="mt-[18px] flex min-h-[56px] flex-wrap gap-[8px] rounded-[14px] p-[8px]" style={{ background: theme.well }} role="group" aria-label="보기 블록">
        {blocks
          .filter((block) => !placed.has(block.id))
          .map((block) => (
            <button
              key={block.id}
              type="button"
              aria-pressed={picked === block.id}
              aria-label={`${block.label} 블록${picked === block.id ? ", 고름. 넣을 빈칸을 누르세요" : ""}`}
              onPointerDown={(e) => down(e, block.id)}
              onClick={() => tapBlock(block.id)}
              {...chip(block.id, ghost?.block === block.id ? { opacity: 0.35 } : {})}
            >
              {block.label}
            </button>
          ))}
        {blocks.every((block) => placed.has(block.id)) && (
          <span className="px-[6px] py-[10px] text-[12.5px]" style={{ color: theme.sub }}>
            보기를 모두 넣었어요. 빈칸을 누르면 블록이 여기로 돌아와요.
          </span>
        )}
      </div>
      {ghost && (
        <span aria-hidden className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: ghost.x, top: ghost.y }}>
          <span {...chip(ghost.block, { boxShadow: "0 8px 18px rgba(0,0,0,0.18)" })}>{label(ghost.block)}</span>
        </span>
      )}
    </div>
  );
}
