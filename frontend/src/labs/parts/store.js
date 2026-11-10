// 체험 중인 작업(쓰던 코드 등)을 이 브라우저에 남긴다. 새로고침하거나 나갔다 와도 이어서 한다.
// 성적·기록(campushi-v2)과 따로 두어, 읽지 못하거나 지워져도 진행 기록에는 영향이 없다.
const KEY = "campushi-lab-v1";
// 파일 하나에 남기는 최대 글자 수(편집기 입력 제한과 같다).
export const MAX_FILE = 20000;

const readAll = () => {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

/** 남겨 둔 작업. 없거나 읽을 수 없으면 null. clean으로 형식을 확인한다. */
export function loadWork(key, clean) {
  try {
    return clean(readAll()[key]) ?? null;
  } catch {
    return null;
  }
}

/** 작업을 남긴다. 저장할 수 없으면(사생활 보호 모드 등) 조용히 넘어가고 false를 돌려준다. */
export function saveWork(key, value) {
  try {
    const all = readAll();
    if (value === null) delete all[key];
    else all[key] = value;
    window.localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}
