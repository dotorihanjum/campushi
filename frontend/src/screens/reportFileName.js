// 체험 리포트 파일 이름. 체험 탭과 마이페이지가 같은 이름을 쓰도록 여기 하나만 둔다(shared.jsx에서 다시 내보낸다).
// JSX가 없는 파일로 두어 node --test로 바로 시험한다.

// 파일 이름으로 쓸 수 없는 문자(Windows 기준 / \ : * ? " < > |, 제어 문자)와 공백.
const UNSAFE = /[/\\:*?"<>|\u0000-\u001f\u007f\s]+/g;

// 이름 한 칸을 파일 이름에 넣을 수 있게 바꾼다. 못 쓰는 문자와 공백은 "-"로 바꾸고(칸 구분자 "_"와 겹치지 않게), 앞뒤의 "-"·"."은 지운다.
function part(value) {
  return String(value ?? "")
    .replace(UNSAFE, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

// 기기 로컬 날짜 YYYY-MM-DD. toISOString()은 UTC라 한국 시간 오전 9시 전에는 전날이 되므로 쓰지 않는다.
function localDate(now) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 캠퍼스하이_학교_학과_YYYY-MM-DD.txt (예: 캠퍼스하이_경희대학교_컴퓨터공학과_2026-11-18.txt). 날짜는 내려받는 기기의 로컬 날짜다. */
export function reportFileName(school, name, now = new Date()) {
  return `${["캠퍼스하이", part(school), part(name), localDate(now)].filter(Boolean).join("_")}.txt`;
}
