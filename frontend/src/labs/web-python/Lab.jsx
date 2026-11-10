import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "../../ui.jsx";
import { LabButton, LabShell, Takeaway, THEMES } from "../LabShell.jsx";
import { CodeEditor, Snippets } from "../parts/CodeEditor.jsx";
import { Sandbox } from "../parts/Sandbox.jsx";
import { Checklist } from "../parts/Checklist.jsx";
import { loadWork, MAX_FILE, saveWork } from "../parts/store.js";
import { buildDocument, insertAt, missionDone, scoreOf } from "./logic.js";

const theme = THEMES.code;
// 고친 뒤 미리보기를 다시 그리기까지 기다리는 시간(ms). 글자마다 다시 그리지 않는다.
const REBUILD = 450;
// 이 시간 안에 채점 결과가 오지 않으면(끝나지 않는 반복문 등) 알린다.
const CHECK_TIMEOUT = 4000;
// 콘솔에 남기는 줄 수.
const CONSOLE_LINES = 30;

let counter = 0;
const newToken = () => `lab-${Date.now().toString(36)}-${(counter += 1)}`;

/** 남겨 둔 작업의 형식 확인. */
const cleanWork = (files) => (work) => {
  if (!work || typeof work !== "object") return null;
  const value = {};
  for (const file of files) {
    if (typeof work.files?.[file.id] !== "string") return null;
    value[file.id] = work.files[file.id].slice(0, MAX_FILE);
  }
  const stage = Number.isInteger(work.stage) ? work.stage : -1;
  return { files: value, stage, reached: Number.isInteger(work.reached) ? Math.max(stage, work.reached) : stage };
};

/**
 * 웹/파이선프로그래밍 실습: 자기소개 웹사이트 텀프로젝트. 과제 명세 → HTML → CSS → JavaScript → 제출(채점).
 * lab: data.js의 webPython, saveKey: 작업을 남길 이름, onDone(summary, score): 제출했을 때, onQuit: 나가기.
 */
export default function WebPythonLab({ lab, subject, saveKey, onDone, onQuit }) {
  const { checks, missions, files: fileList } = lab;
  const saved = useMemo(() => loadWork(saveKey, cleanWork(fileList)), [saveKey, fileList]);
  const [files, setFiles] = useState(() => saved?.files ?? { ...lab.starter });
  // -1 과제 명세, 0~ 미션, missions.length 제출 결과.
  const [stage, setStage] = useState(() => Math.min(saved?.stage ?? -1, missions.length - 1));
  const [reached, setReached] = useState(() => Math.min(saved?.reached ?? -1, missions.length - 1));
  const mission = missions[Math.max(0, Math.min(stage, missions.length - 1))];
  const [active, setActive] = useState(mission.file);
  const cursors = useRef({});
  const editor = useRef(null);
  const body = useRef(null);
  const [docs, setDocs] = useState(() => make(files));
  const [results, setResults] = useState(null);
  const [stuck, setStuck] = useState(false);
  const [lines, setLines] = useState([]);
  const [storable, setStorable] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);

  function make(value) {
    const token = newToken();
    return { token, view: buildDocument(value, token, "view"), check: buildDocument(value, token, "check") };
  }

  // 고치면 잠시 뒤 미리보기를 다시 그리고 다시 채점한다. 작업은 이 브라우저에 남긴다.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setResults(null);
      setStuck(false);
      setLines([]);
      setDocs(make(files));
    }, REBUILD);
    return () => window.clearTimeout(timer);
  }, [files]);
  useEffect(() => {
    setStorable(saveWork(saveKey, { files, stage, reached }));
  }, [saveKey, files, stage, reached]);
  useEffect(() => {
    if (results) return undefined;
    const timer = window.setTimeout(() => setStuck(true), CHECK_TIMEOUT);
    return () => window.clearTimeout(timer);
  }, [docs.token, results]);
  // 단계를 옮기면 맨 위로.
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [stage]);

  const onMessage = (data, mode) => {
    if (data.type === "result" && mode === "check" && data.results && typeof data.results === "object") {
      setResults(Object.fromEntries(checks.map((check) => [check.id, data.results[check.id] === true])));
      setStuck(false);
    } else if (data.type === "console" && mode === "view") {
      setLines((old) => [...old, { level: String(data.level), text: String(data.text).slice(0, 300) }].slice(-CONSOLE_LINES));
    } else if (data.type === "link" && mode === "view") {
      setLines((old) =>
        [...old, { level: "info", text: `링크를 눌렀어요: ${String(data.href).slice(0, 200)} (미리보기에서는 다른 페이지로 이동하지 않아요)` }].slice(-CONSOLE_LINES),
      );
    }
  };

  const change = (id, text) => setFiles((old) => ({ ...old, [id]: text.slice(0, MAX_FILE) }));
  const insert = (snippet) => {
    const id = snippet.file || mission.file;
    const text = files[id] ?? "";
    const at = insertAt(text, cursors.current[id], id);
    const next = text.slice(0, at) + snippet.code + text.slice(at);
    if (next.length > MAX_FILE) return;
    cursors.current[id] = at + snippet.code.length;
    setActive(id);
    change(id, next);
  };
  const go = (next) => {
    setStage(next);
    setReached((r) => Math.max(r, Math.min(next, missions.length - 1)));
    if (next >= 0 && next < missions.length) setActive(missions[next].file);
  };
  const reset = () => {
    cursors.current = {};
    setFiles({ ...lab.starter });
    setConfirmReset(false);
    go(0);
  };

  const score = scoreOf(checks, results);
  const done = stage >= 0 && stage < missions.length && missionDone(checks, results, mission.id);
  const steps = ["과제", ...missions.map((m) => m.label), "제출"];
  const shellStep = stage + 1;
  const status = !results ? (stuck ? "채점 결과를 받지 못했어요. 끝나지 않는 반복문이 있는지 확인해 보세요." : "미리보기를 그리고 채점하는 중이에요…") : null;
  const remaining = stage >= 0 && stage < missions.length ? checks.filter((c) => c.mission === mission.id && c.core && results?.[c.id] !== true).length : 0;

  let content;
  let footer;
  if (stage < 0) {
    content = (
      <>
        <p className="text-[12px] font-semibold" style={{ color: theme.accent }}>
          텀프로젝트 과제 명세
        </p>
        <h2 className="mt-[4px] text-[22px] font-bold leading-[30px]">{lab.title}</h2>
        <p className="mt-[8px] text-[14px] leading-[22px]" style={{ color: theme.sub }}>
          {lab.task}
        </p>
        <ol className="mt-[16px] grid gap-[8px]">
          {missions.map((m, i) => (
            <li key={m.id} className="rounded-[12px] p-[12px]" style={{ background: theme.panel, border: `1px solid ${theme.line}` }}>
              <p className="text-[12px] font-bold" style={{ color: theme.accent }}>{`${i + 1}. ${m.label} · ${fileList.find((f) => f.id === m.file).name}`}</p>
              <p className="mt-[4px] text-[13px] leading-[20px]">{m.goal}</p>
            </li>
          ))}
        </ol>
        <h3 className="mt-[18px] text-[14px] font-bold">채점 기준</h3>
        <p className="mt-[4px] text-[12.5px] leading-[19px]" style={{ color: theme.sub }}>
          필수 항목을 모두 통과해야 다음 단계로 가요. 성적은 전체 {checks.length}개 항목 중 통과한 비율이에요.
        </p>
        <div className="mt-[10px]">
          <Checklist theme={theme} checks={checks} results={{}} label="채점 기준" />
        </div>
      </>
    );
    footer = (
      <LabButton theme={theme} onClick={() => go(Math.max(0, reached))}>
        {reached >= 0 ? "이어서 하기" : "작업 시작"}
      </LabButton>
    );
  } else if (stage < missions.length) {
    const mine = checks.filter((c) => c.mission === mission.id);
    content = (
      <>
        <section className="rounded-[12px] p-[12px]" style={{ background: theme.panel, border: `1px solid ${theme.line}` }}>
          <p className="text-[12px] font-bold" style={{ color: theme.accent }}>{`${stage + 1}/${missions.length} · ${mission.label}`}</p>
          <p className="mt-[4px] text-[13.5px] leading-[20px]">{mission.goal}</p>
          <div className="mt-[10px]">
            <Checklist theme={theme} checks={mine} results={results} label={`${mission.label} 채점 항목`} />
          </div>
          <p role="status" className="mt-[8px] min-h-[18px] text-[12px] leading-[18px]" style={{ color: theme.sub }}>
            {status || (done ? "필수 항목을 모두 통과했어요!" : `필수 항목이 ${remaining}개 남았어요.`)}
          </p>
        </section>
        <div className="mt-[12px]">
          <Snippets theme={theme} items={mission.snippets} onInsert={insert} />
        </div>
        <div className="mt-[8px]">
          <CodeEditor
            theme={theme}
            files={fileList}
            value={files}
            active={active}
            onActive={setActive}
            onChange={change}
            onCursor={(id, at) => {
              cursors.current[id] = at;
            }}
            editorRef={editor}
          />
        </div>
        <div className="mt-[12px]">
          <Sandbox theme={theme} docs={docs} onMessage={onMessage} title="내가 만든 페이지 미리보기" />
        </div>
        <section className="mt-[12px] rounded-[12px] p-[10px]" style={{ background: "#11151f", border: `1px solid ${theme.line}` }} aria-label="콘솔">
          <p className="font-mono text-[11px]" style={{ color: theme.sub }}>
            콘솔
          </p>
          {lines.length ? (
            <ul className="mt-[4px] grid gap-[2px] font-mono text-[11.5px] leading-[17px]" aria-live="polite">
              {lines.map((line, i) => (
                <li key={i} style={{ color: line.level === "error" ? "#ff8a8a" : line.level === "warn" ? "#ffd27a" : theme.text, overflowWrap: "anywhere" }}>
                  {line.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-[4px] font-mono text-[11.5px]" style={{ color: theme.sub }}>
              출력이 없어요.
            </p>
          )}
        </section>
        <div className="mt-[14px] flex flex-wrap items-center gap-[8px] text-[12px]" style={{ color: theme.sub }}>
          {stage > 0 && (
            <button className="pressable h-[34px] rounded-full px-[12px] font-semibold" style={{ border: `1px solid ${theme.line}`, color: theme.text }} onClick={() => go(stage - 1)}>
              ← 이전 단계
            </button>
          )}
          <button className="pressable h-[34px] rounded-full px-[12px] font-semibold" style={{ border: `1px solid ${theme.line}`, color: theme.text }} onClick={() => setConfirmReset(true)}>
            처음부터 다시
          </button>
          {!storable && <span>이 브라우저에 저장할 수 없어, 나가거나 새로고침하면 쓴 코드가 사라져요.</span>}
        </div>
      </>
    );
    const last = stage === missions.length - 1;
    footer = (
      <LabButton theme={theme} disabled={!done} onClick={() => go(stage + 1)}>
        {done ? (last ? "과제 제출하기" : `다음: ${missions[stage + 1].label}`) : status ? "채점하는 중…" : `필수 항목 ${remaining}개를 먼저 끝내요`}
      </LabButton>
    );
  } else {
    content = (
      <>
        <p className="text-[12px] font-semibold" style={{ color: theme.accent }}>
          제출 완료
        </p>
        <h2 className="mt-[4px] text-[22px] font-bold leading-[30px]">{`채점 결과 ${score.correct}/${score.total}`}</h2>
        <p role="status" className="mt-[6px] text-[13px] leading-[20px]" style={{ color: theme.sub }}>
          {status || "완성도 항목까지 통과하면 성적이 올라가요. 더 고치고 다시 제출해도 돼요."}
        </p>
        <div className="mt-[12px]">
          <Sandbox theme={theme} docs={docs} onMessage={onMessage} title="완성한 페이지" height={300} />
        </div>
        <div className="mt-[14px] rounded-[12px] p-[12px]" style={{ background: theme.panel, border: `1px solid ${theme.line}` }}>
          <Checklist theme={theme} checks={checks} results={results} label="채점 결과" />
        </div>
        <div className="mt-[14px]">
          <Takeaway theme={theme} subject={subject}>
            {lab.takeaway}
          </Takeaway>
        </div>
        <div className="mt-[12px]">
          <LabButton theme={theme} ghost onClick={() => go(missions.length - 1)}>
            더 고치기
          </LabButton>
        </div>
      </>
    );
    footer = (
      <LabButton theme={theme} disabled={!results} onClick={() => onDone(`자기소개 웹사이트 제출 · 채점 ${score.correct}/${score.total}`, score)}>
        {results ? "이 결과로 제출하고 기록하러 가기" : "채점하는 중…"}
      </LabButton>
    );
  }

  return (
    <>
      <LabShell theme={theme} title={`${subject} · 텀프로젝트`} steps={steps} step={shellStep} onQuit={onQuit} footer={footer} bodyRef={body}>
        {content}
      </LabShell>
      {confirmReset && (
        <Dialog
          title="처음부터 다시 할까요?"
          onClose={() => setConfirmReset(false)}
          actions={
            <>
              <button className="button ghost" onClick={() => setConfirmReset(false)}>
                취소
              </button>
              <button className="button" onClick={reset}>
                처음부터
              </button>
            </>
          }
        >
          <p className="text-[13px] leading-[20px] text-ink-3">지금까지 쓴 HTML·CSS·JavaScript가 모두 처음 상태로 돌아가요.</p>
        </Dialog>
      )}
    </>
  );
}
