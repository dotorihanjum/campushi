import React, { useId, useRef } from "react";
import { MAX_FILE } from "./store.js";

/**
 * 파일 탭이 있는 코드 편집기. 글자는 그대로 쓰고(자동 고침·자동 대문자 없음), 왼쪽에 줄 번호를 둔다.
 * Tab 키는 브라우저 기본대로 다음 요소로 초점을 옮긴다(키보드만으로도 편집기를 빠져나갈 수 있게).
 * files: [{ id, name }], value: { [id]: 글 }, active: 보이는 파일 id, onCursor(id, 위치): 커서가 움직였을 때.
 */
export function CodeEditor({ theme, files, value, active, onActive, onChange, onCursor, editorRef, height = 220 }) {
  const gutter = useRef(null);
  const tabsId = useId();
  const text = value[active] ?? "";
  const lines = text.split("\n").length;
  const remember = (e) => onCursor?.(active, e.currentTarget.selectionStart);
  return (
    <section className="overflow-hidden rounded-[12px]" style={{ background: theme.panel, border: `1px solid ${theme.line}` }}>
      <div role="tablist" aria-label="파일" className="no-scrollbar flex overflow-x-auto" style={{ borderBottom: `1px solid ${theme.line}` }}>
        {files.map((file) => {
          const on = file.id === active;
          return (
            <button
              key={file.id}
              role="tab"
              id={`${tabsId}-${file.id}`}
              aria-selected={on}
              aria-controls={`${tabsId}-panel`}
              onClick={() => onActive(file.id)}
              className="pressable h-[38px] shrink-0 px-[14px] font-mono text-[12.5px]"
              style={{
                color: on ? theme.text : theme.sub,
                background: on ? theme.bg : "transparent",
                boxShadow: on ? `inset 0 -2px 0 ${theme.accent}` : "none",
              }}
            >
              {file.name}
            </button>
          );
        })}
      </div>
      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${active}`} className="flex focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-mint focus-within:outline" style={{ height }}>
        <div
          ref={gutter}
          aria-hidden
          className="no-scrollbar shrink-0 select-none overflow-hidden py-[10px] pl-[8px] pr-[10px] text-right font-mono text-[12px] leading-[19px]"
          style={{ color: "#6f7a96", minWidth: 30 }}
        >
          {Array.from({ length: lines }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={editorRef}
          aria-label={`${files.find((f) => f.id === active)?.name} 편집`}
          value={text}
          maxLength={MAX_FILE}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          wrap="off"
          onChange={(e) => {
            onChange(active, e.target.value);
            remember(e);
          }}
          onSelect={remember}
          onScroll={(e) => {
            if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
          }}
          className="min-w-0 flex-1 resize-none bg-transparent py-[10px] pl-[4px] pr-[10px] font-mono text-[12.5px] leading-[19px] outline-none focus-visible:outline-none"
          style={{ color: theme.text, caretColor: theme.accent, tabSize: 2 }}
        />
      </div>
    </section>
  );
}

/** 코드 조각 넣기 버튼 줄. */
export function Snippets({ theme, items, onInsert }) {
  return (
    <div className="no-scrollbar -mx-[14px] flex gap-[6px] overflow-x-auto px-[14px]" role="group" aria-label="코드 조각 넣기">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => onInsert(item)}
          className="pressable h-[32px] shrink-0 rounded-full px-[12px] text-[12.5px] font-semibold"
          style={{ color: theme.accent, border: `1px solid ${theme.line}`, background: theme.panel }}
        >
          {`+ ${item.label}`}
        </button>
      ))}
    </div>
  );
}
