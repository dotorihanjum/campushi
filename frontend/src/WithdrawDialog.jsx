// #36 회원 탈퇴 확인 창: 지워지는 것, 소멸하는 크레딧, 남는 법정 보관 기록을 나눠 보여 주고, 서버가 지운 뒤에만 끝났다고 알린다.
import { useEffect, useId, useRef, useState } from "react";
import { Dialog } from "./ui.jsx";
import { CREDIT_FORFEIT, deletedItems, withdrawFailure } from "./withdraw.js";

export function WithdrawDialog({ auth, onClose }) {
  const [summary, setSummary] = useState({ status: "loading" });
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const request = useRef(0);
  const ids = useId();
  const load = async () => {
    const at = ++request.current;
    setSummary({ status: "loading" });
    try {
      const data = await auth.withdrawSummary();
      if (at === request.current) setSummary({ status: "ready", data });
    } catch (e) {
      if (at === request.current) setSummary({ status: "error", error: withdrawFailure(e) });
    }
  };
  useEffect(() => {
    load();
    return () => {
      request.current++;
    };
    // 창을 열 때 한 번만 불러온다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const close = () => {
    if (lock.current) return;
    onClose();
  };
  const submit = async () => {
    if (lock.current || summary.status !== "ready" || !agreed) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await auth.withdraw();
      // 성공하면 App이 시작 화면으로 옮기면서 이 창도 사라진다.
    } catch (e) {
      lock.current = false;
      setBusy(false);
      setError(withdrawFailure(e));
    }
  };
  const pending = auth.records?.pending || 0;
  const data = summary.data;
  return (
    <Dialog
      title="회원 탈퇴할까요?"
      onClose={close}
      actions={
        <>
          <button className="button ghost" data-autofocus disabled={busy} onClick={close}>
            취소
          </button>
          <button className="button danger" disabled={busy || summary.status !== "ready" || !agreed} onClick={submit} aria-describedby={`${ids}-credit`}>
            {busy ? "탈퇴하고 있어요…" : "탈퇴하기"}
          </button>
        </>
      }
    >
      <div className="my-withdraw" style={{ maxHeight: "calc((var(--vh) - 250) * 1px)" }}>
        {summary.status === "loading" && <p role="status">탈퇴하면 지워지는 내용을 확인하고 있어요…</p>}
        {summary.status === "error" && (
          <>
            <p role="alert" className="my-profile-error">{`탈퇴 전에 확인할 내용을 불러오지 못했어요. ${summary.error}`}</p>
            <button className="my-action" onClick={load}>다시 불러오기</button>
          </>
        )}
        {data && (
          <>
            <section aria-labelledby={`${ids}-deleted`}>
              <h3 id={`${ids}-deleted`}>지워지는 것</h3>
              <ul>
                {deletedItems(data, auth.user).map((text) => <li key={text}>{text}</li>)}
              </ul>
              <p>탈퇴하면 바로 지워지고 되돌릴 수 없어요. 남겨 둘 리포트는 먼저 내려받아 주세요.</p>
              {pending > 0 && <p>{`아직 서버에 보내지 못한 기록 ${pending}건도 함께 지워져요.`}</p>}
            </section>
            <section aria-labelledby={`${ids}-credits`}>
              <h3 id={`${ids}-credits`}>소멸하는 크레딧</h3>
              <p className="my-withdraw-credit">남은 크레딧 <strong>{data.credits}</strong></p>
              <p id={`${ids}-credit`}>{CREDIT_FORFEIT}</p>
            </section>
            <section aria-labelledby={`${ids}-kept`}>
              <h3 id={`${ids}-kept`}>남는 법정 보관 기록</h3>
              <p>없어요. 지금은 결제나 멘토링 기능이 없어 법에 따라 따로 보관하는 기록이 없어요.</p>
            </section>
            {auth.records?.importAvailable && (
              <p className="my-withdraw-note">로그인 전에 이 브라우저에만 저장한 기록은 계정과 별개라 이 브라우저에 그대로 남아요. 지우려면 탈퇴한 뒤 마이페이지의 ‘처음부터 다시 시작하기’를 눌러 주세요.</p>
            )}
            <label className="my-withdraw-agree">
              <input type="checkbox" checked={agreed} disabled={busy} onChange={(e) => setAgreed(e.target.checked)} />
              <span>위 내용을 확인했고, 크레딧이 소멸하는 데 동의해요.</span>
            </label>
          </>
        )}
        {error && <p role="alert" className="my-profile-error">{error}</p>}
      </div>
    </Dialog>
  );
}
