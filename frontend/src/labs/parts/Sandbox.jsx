import React, { useEffect, useRef } from "react";

// 미리보기 틀 페이지(frontend/public/lab-frame.html). srcdoc은 앱의 보안 정책(script-src 'self')을 물려받아 안의 스크립트가
// 돌지 않으므로, 따로 정책을 받는 이 페이지를 띄우고 문서를 postMessage로 넘긴다.
const FRAME = `${import.meta.env?.BASE_URL ?? "/"}lab-frame.html`;

/**
 * 사용자가 만든 페이지를 격리해서 보여 주는 미리보기. sandbox="allow-scripts"만 주어(같은 출처·폼 제출·팝업·상위 이동 권한 없음)
 * 페이지의 스크립트가 앱의 저장소·화면에 닿지 못한다. 보이는 미리보기(view)와, 채점용으로 버튼까지 눌러 보는 숨은 미리보기(check)를
 * 함께 띄운다. 틀이 준비됐다고 알리면 문서를 보내고, 그 뒤로는 지금 문서(token)의 iframe에서 온 메시지만 받는다.
 *
 * docs: { token, view, check } (문서 문자열), onMessage(data, mode)
 */
export function Sandbox({ theme, docs, onMessage, title, height = 260, address = "index.html" }) {
  const view = useRef(null);
  const check = useRef(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;
  const current = useRef(docs);
  current.current = docs;
  useEffect(() => {
    const listen = (event) => {
      const mode = event.source && event.source === view.current?.contentWindow ? "view" : event.source && event.source === check.current?.contentWindow ? "check" : null;
      const data = event.data;
      if (!mode || !data || typeof data !== "object") return;
      if (data.type === "campushi-lab-ready") {
        event.source.postMessage({ type: "campushi-lab-doc", html: current.current[mode] }, "*");
        return;
      }
      if (data.channel === current.current.token) handler.current(data, mode);
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, []);
  return (
    <section className="overflow-hidden rounded-[12px] bg-white" style={{ border: `1px solid ${theme.line}` }}>
      <div className="flex h-[30px] items-center gap-[6px] px-[10px]" style={{ background: theme.panel }} aria-hidden>
        <span className="h-[8px] w-[8px] rounded-full bg-[#ff6b6b]" />
        <span className="h-[8px] w-[8px] rounded-full bg-[#ffd32f]" />
        <span className="h-[8px] w-[8px] rounded-full bg-[#3ddc84]" />
        <span className="ml-[6px] min-w-0 flex-1 truncate rounded-full px-[10px] font-mono text-[11px] leading-[18px]" style={{ background: theme.bg, color: theme.sub }}>
          {address}
        </span>
      </div>
      <div className="relative" style={{ height }}>
        {/* 문서가 바뀌면 틀을 새로 띄운다(이전 페이지의 스크립트·타이머가 남지 않게). */}
        <iframe
          ref={view}
          key={`view-${docs.token}`}
          title={title}
          sandbox="allow-scripts"
          src={FRAME}
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full border-0 bg-white"
        />
        {/* 채점용: 화면에는 안 보이지만 같은 폭으로 그려서 실제 스타일로 검사한다. */}
        <iframe
          ref={check}
          key={`check-${docs.token}`}
          title={`${title} 채점용`}
          sandbox="allow-scripts"
          src={FRAME}
          referrerPolicy="no-referrer"
          aria-hidden
          tabIndex={-1}
          className="invisible absolute inset-0 h-full w-full border-0"
        />
      </div>
    </section>
  );
}
