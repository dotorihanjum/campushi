import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "./ui.jsx";
import { SignupForm } from "./SignupForm.jsx";
import { signupBlocked } from "./signup.js";
import { PROVIDER_NAMES } from "./login.js";

export function LoginPanel({ auth, portalTarget }) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [open, setOpen] = useState(() =>
    ["signup", "error", "cancelled"].includes(auth.result),
  );
  const [mode, setMode] = useState(() =>
    auth.result === "signup" ? "signup" : "login",
  );
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const run = async (action) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const close = () => {
    if (busy) return;
    const finish = () => {
      setOpen(false);
      setError("");
      auth.clearResult();
    };
    if (auth.pending || auth.preflight)
      run(async () => {
        await auth.cancel();
        finish();
      });
    else finish();
  };
  const providers = auth.linkProvider
    ? auth.providers.filter((p) => p === auth.linkProvider)
    : auth.providers;
  const emailAllowed =
    auth.email && (!auth.linkProvider || auth.linkProvider === "email");
  return (
    <section className="my-login my-section" aria-label="로그인 및 계정">
      <div className="my-section-heading">
        <h2>{auth.user ? "로그인한 계정" : "기록을 이어갈 준비"}</h2>
      </div>
      {auth.loading ? (
        <p className="my-secondary" role="status">
          계정을 확인하고 있어요…
        </p>
      ) : auth.user ? (
        <>
          <p className="my-secondary">
            {auth.user.email ||
              `${PROVIDER_NAMES[auth.user.provider]} 계정으로 로그인했어요.`}
          </p>
          <p className="my-secondary" role="status">
            {auth.records?.phase === "loading"
              ? "계정 기록을 불러오고 있어요…"
              : auth.records?.phase === "saving"
                ? "기록을 저장하고 있어요…"
                : auth.records?.pending
                  ? "연결되면 저장할게요."
                  : "프로필과 체험 기록을 계정에 저장했어요."}
          </p>
          {auth.records?.error && (
            <>
              <p role="alert" className="my-profile-error">
                {auth.records.error}
              </p>
              <button
                className="my-action"
                disabled={busy}
                onClick={() => run(auth.records.retry)}
              >
                저장 다시 시도
              </button>
            </>
          )}
          {auth.records?.memoryOnly && auth.records?.pending > 0 && (
            <p role="alert" className="my-profile-error">
              이 브라우저에 임시 기록을 보관하지 못했어요. 저장될 때까지 창을
              닫지 말아 주세요.
            </p>
          )}
          {auth.records?.importAvailable && (
            <>
              <p className="my-secondary">
                이 브라우저에서 체험한 기록을 가져올 수 있어요. 크레딧은
                옮겨지지 않아요. 이제부터 이수하면 쌓여요.
              </p>
              <button
                className="my-action primary"
                disabled={busy}
                onClick={() => run(auth.records.importGuest)}
              >
                이 브라우저 기록 가져오기
              </button>
            </>
          )}
          {auth.records?.imported && (
            <p role="status" className="my-secondary">
              기록을 가져왔어요. 크레딧은 옮겨지지 않아요. 이제부터 이수하면
              쌓여요.
            </p>
          )}
          <button
            className="my-action"
            onClick={() => {
              setLogoutOpen(true);
              setUnsaved(false);
              setError("");
            }}
            disabled={busy}
          >
            로그아웃
          </button>
        </>
      ) : (
        <>
          <p className="my-secondary">체험은 로그인 없이도 할 수 있어요.</p>
          <button
            className="my-action primary mt-[12px]"
            onClick={() => {
              setMode("login");
              setOpen(true);
              setSent(false);
            }}
          >
            로그인 <span aria-hidden>→</span>
          </button>
        </>
      )}
      {auth.error && (
        <>
          <p role="alert" className="my-profile-error">
            {auth.error}
          </p>
          <button
            className="my-action"
            disabled={busy}
            onClick={() => run(auth.refresh)}
          >
            다시 확인하기
          </button>
        </>
      )}
      {error && !open && (
        <p role="alert" className="my-profile-error">
          {error}
        </p>
      )}
      {logoutOpen &&
        portalTarget &&
        createPortal(
          <Dialog
            title="로그아웃할까요?"
            onClose={() => {
              if (!busy) {
                setLogoutOpen(false);
                setError("");
              }
            }}
            actions={
              <>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      try {
                        await auth.logout({ discard: unsaved });
                        setLogoutOpen(false);
                      } catch (e) {
                        if (e.unsaved) setUnsaved(true);
                        throw e;
                      }
                    })
                  }
                >
                  {busy
                    ? "기록을 확인하고 있어요…"
                    : unsaved
                      ? "저장하지 않고 로그아웃"
                      : "로그아웃"}
                </button>
                <button
                  className="button ghost"
                  disabled={busy}
                  onClick={() => {
                    setLogoutOpen(false);
                    setError("");
                  }}
                >
                  취소
                </button>
              </>
            }
          >
            <p>
              {unsaved
                ? "저장되지 않은 기록이 있어요. 그래도 로그아웃할까요? 저장되지 않은 기록은 이 기기에서 지워져요."
                : "로그아웃하면 이 기기에서는 기록이 안 보여요. 다시 로그인하면 그대로 있어요."}
            </p>
            {error && !unsaved && (
              <p role="alert" className="my-profile-error">
                {error}
              </p>
            )}
          </Dialog>,
          portalTarget,
        )}
      {open &&
        portalTarget &&
        createPortal(
          <Dialog
            title={
              mode === "signup" && !auth.linkProvider
                ? "처음 가입하기"
                : "로그인"
            }
            onClose={close}
            actions={
              <button className="button ghost" disabled={busy} onClick={close}>
                {mode === "signup" && signupBlocked()
                  ? "로그인 없이 체험하기"
                  : "체험 계속하기"}
              </button>
            }
          >
            {mode === "signup" && !auth.linkProvider && auth.signup_notice ? (
              <p role="status">{auth.signup_notice}</p>
            ) : mode === "signup" && !auth.linkProvider && auth.policy ? (
              <SignupForm
                key={auth.pending ? "verified" : "new"}
                auth={auth}
                onBusy={setBusy}
                onAuthenticated={() => {
                  setOpen(false);
                  auth.clearResult();
                }}
                onNeedsLogin={() => setMode("login")}
              />
            ) : (
              <>
                <p>체험은 로그인 없이도 할 수 있어요.</p>
                {auth.result === "cancelled" && (
                  <p role="status" className="my-secondary mt-[10px]">
                    로그인을 취소했어요. 다시 시도할 수 있어요.
                  </p>
                )}
                {auth.result === "error" && (
                  <p role="alert" className="my-profile-error">
                    로그인을 마치지 못했어요. 처음 요청한 브라우저에서 다시
                    시도해 주세요.
                  </p>
                )}
                {auth.pending && (
                  <p className="my-secondary mt-[10px]">
                    {auth.linkProvider
                      ? `같은 이메일의 계정이 있어요. 기존 ${PROVIDER_NAMES[auth.linkProvider]} 계정으로 한 번 더 로그인해야 안전하게 연결할 수 있어요.`
                      : "처음 오셨네요. 가입 내용을 확인해 주세요."}
                  </p>
                )}
                <div className="my-login-options">
                  {providers.map((p) => (
                    <button
                      key={p}
                      className="button"
                      disabled={busy}
                      onClick={() => {
                        if (auth.policy && signupBlocked()) {
                          setMode("signup");
                          return;
                        }
                        run(() => auth.login(p, !!auth.linkProvider));
                      }}
                    >
                      {PROVIDER_NAMES[p]}로{" "}
                      {auth.linkProvider ? "다시 로그인" : "계속하기"}
                    </button>
                  ))}
                  {emailAllowed && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (auth.policy && signupBlocked()) {
                          setMode("signup");
                          return;
                        }
                        run(async () => {
                          await auth.sendEmail(
                            email.trim(),
                            !!auth.linkProvider,
                          );
                          setSent(true);
                        });
                      }}
                    >
                      <label htmlFor="login-email">이메일 주소</label>
                      <input
                        id="login-email"
                        data-autofocus
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        maxLength={254}
                        required
                        disabled={busy}
                        placeholder="이메일을 입력해 주세요"
                        className="my-login-input"
                      />
                      <button
                        className="button"
                        type="submit"
                        disabled={busy || !email.trim()}
                      >
                        {busy
                          ? "요청 중…"
                          : sent
                            ? "로그인 링크 다시 받기"
                            : "이메일로 로그인 링크 받기"}
                      </button>
                    </form>
                  )}
                  {!providers.length && !emailAllowed && (
                    <p role="status">
                      로그인 연결을 준비하고 있어요. 체험은 바로 계속할 수
                      있어요.
                    </p>
                  )}
                  {sent && (
                    <p role="status" className="my-login-notice">
                      메일함과 스팸함을 확인해 주세요. 요청한 이 브라우저에서
                      10분 안에 링크를 열어 주세요.
                    </p>
                  )}
                </div>
                {auth.signup_notice && !auth.linkProvider && (
                  <p role="status" className="my-secondary">{auth.signup_notice}</p>
                )}
                {!auth.linkProvider && auth.policy && (
                  <button
                    className="my-signup-entry"
                    onClick={() => setMode("signup")}
                  >
                    처음이신가요? 가입 안내 보기
                  </button>
                )}
              </>
            )}
            {error && (
              <p role="alert" className="my-profile-error mt-[12px]">
                {error}
              </p>
            )}
          </Dialog>,
          portalTarget,
        )}
    </section>
  );
}
