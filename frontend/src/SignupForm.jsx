import { useEffect, useRef, useState } from "react";
import { blockSignup, signupBlocked, signupBody, refreshSignupConsent } from "./signup.js";

export function SignupForm({ auth, onAuthenticated, onNeedsLogin, onBusy }) {
  const preset = auth.preflight;
  const [form, setForm] = useState({ year: preset?.birth_year || "", role: preset?.role || "student", terms: !!preset?.terms_agreed, privacy: !!preset?.privacy_agreed, version: auth.policy.version });
  const [blocked, setBlocked] = useState(signupBlocked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const birthField = useRef(null);
  useEffect(() => setForm((f) => refreshSignupConsent(f, auth.policy.version)), [auth.policy.version]);
  useEffect(() => birthField.current?.focus({ preventScroll: true }), []);
  const change = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setError(""); };
  const canSubmit = form.year && form.terms && form.privacy;
  const policy = auth.policy;
  if (blocked) return <div className="my-signup-blocked" role="status"><p className="font-semibold text-navy">만 14세 이상부터 가입할 수 있어요.</p><p className="mt-[8px]">학과 체험은 로그인 없이 계속할 수 있어요.</p></div>;
  const submit = async (event) => {
    event.preventDefault();
    if (lock.current || !canSubmit) return;
    lock.current = true; setBusy(true); onBusy(true); setError("");
    try {
      const body = signupBody(form, form.version);
      if (auth.pending) { await auth.register(body); onAuthenticated(); }
      else { await auth.checkEligibility(body); onNeedsLogin(); }
    } catch (e) {
      if (e.code === "signup_age_restricted") { blockSignup(); setBlocked(true); }
      else setError(e.message);
    }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  };
  return <form onSubmit={submit} className="my-signup-form">
    <p className="my-secondary">출생연도와 동의를 확인한 뒤 계정을 만들어요.</p>
    <fieldset disabled={busy}>
      <legend>어떻게 시작할까요?</legend>
      <div className="my-signup-role">
        <label><input type="radio" name="signup-role" value="student" checked={form.role === "student"} onChange={() => change("role", "student")} /> 학생으로 시작</label>
        <label><input type="radio" name="signup-role" value="mentor" checked={form.role === "mentor"} onChange={() => change("role", "mentor")} /> 멘토 지원</label>
      </div>
      {form.role === "mentor" && <p className="my-secondary">가입 후 재학생 인증과 승인이 필요해요.</p>}
      <label htmlFor="birth-year" className="block mt-[16px]">태어난 연도</label>
      <select ref={birthField} id="birth-year" data-autofocus className="my-login-input mt-[8px]" value={form.year} onChange={(e) => change("year", e.target.value)} required>
        <option value="">출생연도를 선택해 주세요</option>
        {Array.from({ length: auth.year - 1899 }, (_, i) => auth.year - i).map((year) => <option value={year} key={year}>{year}년</option>)}
      </select>
      <p className="my-secondary mt-[6px]">출생연도만 받아요. 만 나이를 확인하기 어려운 경계 연도는 가입이 제한돼요.</p>
      {policy.placeholder && <p className="my-policy-placeholder">개발용 임시 약관 링크예요. 정식 문서로 교체될 예정이에요.</p>}
      <div className="my-signup-consents">
        <div><label><input type="checkbox" checked={form.terms} onChange={(e) => change("terms", e.target.checked)} /> 이용약관 동의 (필수)</label><a href={policy.terms_url} target="_blank" rel="noopener noreferrer">보기</a></div>
        <div><label><input type="checkbox" checked={form.privacy} onChange={(e) => change("privacy", e.target.checked)} /> 개인정보 처리방침 확인 (필수)</label><a href={policy.privacy_url} target="_blank" rel="noopener noreferrer">보기</a></div>
      </div>
    </fieldset>
    {error && <p role="alert" className="my-profile-error">{error}</p>}
    <button className="button w-full" type="submit" disabled={busy || !canSubmit}>{busy ? "확인 중…" : auth.pending ? "동의하고 가입 완료" : "동의하고 인증하기"}</button>
  </form>;
}
