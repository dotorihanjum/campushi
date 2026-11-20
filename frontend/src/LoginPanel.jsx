import { useRef, useState } from "react";
import { Dialog } from "./ui.jsx";
import { SignupForm } from "./SignupForm.jsx";
import { signupBlocked } from "./signup.js";
import { PROVIDER_NAMES } from "./login.js";

export function LoginPanel({ auth }) {
  const [open, setOpen] = useState(() => ["signup","error","cancelled"].includes(auth.result));
  const [mode, setMode] = useState(() => auth.result === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const run = async (action) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await action(); } catch (e) { setError(e.message); } finally { lock.current = false; setBusy(false); }
  };
  const close = () => {
    if (busy) return;
    const finish = () => { setOpen(false); setError(""); auth.clearResult(); };
    if (auth.pending || auth.preflight) run(async () => { await auth.cancel(); finish(); });
    else finish();
  };
  const providers = auth.linkProvider ? auth.providers.filter((p) => p === auth.linkProvider) : auth.providers;
  const emailAllowed = auth.email && (!auth.linkProvider || auth.linkProvider === "email");
  return <section className="my-login my-section" aria-label="로그인 및 계정">
    <div className="my-section-heading"><h2>{auth.user ? "로그인한 계정" : "기록을 이어갈 준비"}</h2></div>
    {auth.loading ? <p className="my-secondary" role="status">계정을 확인하고 있어요…</p> : auth.user ? <>
      <p className="my-secondary">{auth.user.email || `${PROVIDER_NAMES[auth.user.provider]} 계정으로 로그인했어요.`}</p>
      <p className="my-secondary">현재 체험 기록은 이 브라우저에 보관돼요.</p>
      <button className="my-action" onClick={() => run(auth.logout)} disabled={busy}>로그아웃</button>
    </> : <>
      <p className="my-secondary">체험은 로그인 없이도 할 수 있어요.</p>
      <button className="my-action primary mt-[12px]" onClick={() => { setOpen(true); setSent(false); }}>로그인 <span aria-hidden>→</span></button>
    </>}
    {auth.error && <><p role="alert" className="my-profile-error">{auth.error}</p><button className="my-action" disabled={busy} onClick={() => run(auth.refresh)}>다시 확인하기</button></>}
    {error && !open && <p role="alert" className="my-profile-error">{error}</p>}
    {open && <Dialog title={mode === "signup" && !auth.linkProvider ? "처음 가입하기" : "로그인"} onClose={close} actions={<button className="button ghost" disabled={busy} onClick={close}>{mode === "signup" && signupBlocked() ? "로그인 없이 체험하기" : "체험 계속하기"}</button>}>
      {mode === "signup" && !auth.linkProvider && auth.policy ? <SignupForm key={auth.pending ? "verified" : "new"} auth={auth} onBusy={setBusy} onAuthenticated={() => { setOpen(false); auth.clearResult(); }} onNeedsLogin={() => setMode("login")} /> : <>
      <p>체험은 로그인 없이도 할 수 있어요.</p>
      {auth.result === "cancelled" && <p role="status" className="my-secondary mt-[10px]">로그인을 취소했어요. 다시 시도할 수 있어요.</p>}
      {auth.result === "error" && <p role="alert" className="my-profile-error">로그인을 마치지 못했어요. 처음 요청한 브라우저에서 다시 시도해 주세요.</p>}
      {auth.pending && <p className="my-secondary mt-[10px]">{auth.linkProvider ? `같은 이메일의 계정이 있어요. 기존 ${PROVIDER_NAMES[auth.linkProvider]} 계정으로 한 번 더 로그인해야 안전하게 연결할 수 있어요.` : "처음 오셨네요. 가입 내용을 확인해 주세요."}</p>}
      <div className="my-login-options">
        {providers.map((p) => <button key={p} className="button" disabled={busy} onClick={() => { if (signupBlocked()) { setMode("signup"); return; } run(() => auth.login(p, !!auth.linkProvider)); }}>{PROVIDER_NAMES[p]}로 {auth.linkProvider ? "다시 로그인" : "계속하기"}</button>)}
        {emailAllowed && <form onSubmit={(e) => { e.preventDefault(); if (signupBlocked()) { setMode("signup"); return; } run(async () => { await auth.sendEmail(email.trim(), !!auth.linkProvider); setSent(true); }); }}>
          <label htmlFor="login-email">이메일 주소</label>
          <input id="login-email" data-autofocus type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required disabled={busy} placeholder="이메일을 입력해 주세요" className="my-login-input" />
          <button className="button" type="submit" disabled={busy || !email.trim()}>{busy ? "요청 중…" : sent ? "로그인 링크 다시 받기" : "이메일로 로그인 링크 받기"}</button>
        </form>}
        {!providers.length && !emailAllowed && <p role="status">로그인 연결을 준비하고 있어요. 체험은 바로 계속할 수 있어요.</p>}
        {sent && <p role="status" className="my-login-notice">메일함과 스팸함을 확인해 주세요. 요청한 이 브라우저에서 10분 안에 링크를 열어 주세요.</p>}
      </div>
      {!auth.linkProvider && <button className="my-signup-entry" onClick={() => setMode("signup")}>처음이신가요? 가입 안내 보기</button>}
      </>}
      {error && <p role="alert" className="my-profile-error mt-[12px]">{error}</p>}
    </Dialog>}
  </section>;
}
