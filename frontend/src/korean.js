// 한국어 조사 고르기. 앱의 "은/는·을/를·이에요/예요·이라서/라서"는 모두 이 파일의 hasBatchim으로 끝 글자의 받침을 본다(#67).
// React를 쓰지 않아 화면 코드와 테스트(node)에서 함께 쓴다.

// 끝에 붙은 따옴표·마침표·닫는 괄호·공백은 읽지 않으므로 건너뛴다(예: "'모든'·'어떤'" → "떤", "합성함수(f∘g)" → "g").
const TRAILING = /[\s'"‘’“”.,!?…)\]}>]+$/u;
// 숫자는 한국어로 읽은 소리의 받침으로 본다. 끝자리가 0이면 영·십·백·천·만 모두 받침이 있다.
// 영(0)·일(1)·삼(3)·육(6)·칠(7)·팔(8)은 받침이 있고, 이(2)·사(4)·오(5)·구(9)는 없다.
const DIGIT_BATCHIM = [true, true, false, true, false, false, true, true, true, false];
const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** 마지막 글자에 받침이 있는지. 한글은 글자의 받침, 숫자(위첨자 포함)는 읽는 소리로 본다. 영문·기호는 받침이 없는 것으로 본다. */
export function hasBatchim(text) {
  const last = [...String(text ?? "").replace(TRAILING, "")].at(-1);
  if (!last) return false;
  const code = last.codePointAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  const digit = /[0-9]/.test(last) ? Number(last) : SUPERSCRIPTS.indexOf(last);
  return digit >= 0 ? DIGIT_BATCHIM[digit] : false;
}

/** 받침이 있으면 withBatchim, 없으면 without. */
export const pick = (text, withBatchim, without) => (hasBatchim(text) ? withBatchim : without);
/** "이에요" / "예요" */
export const copula = (text) => pick(text, "이에요", "예요");
