// 브라우저 저장소(localStorage)를 열고 쓰는 일과, 쓸 수 없을 때 보여 줄 안내의 상태. JSX가 없어 node --test로 바로 시험한다.
// 사파리에서 쿠키·사이트 데이터를 막았거나 iframe 제한이 있으면 window.localStorage를 읽기만 해도 SecurityError가 나고,
// 사생활 보호 모드·용량 초과에서는 setItem이 예외를 던진다. 어느 쪽이든 앱은 이번 방문 동안 메모리로만 진행한다.

/** 저장소를 연다. 여는 것 자체가 예외를 던지거나 저장소가 없으면 null(빈 상태로 시작하고 저장하지 않는다). */
export function openStorage(get) {
  try {
    return get() ?? null;
  } catch {
    return null;
  }
}

/** 저장소에 쓴다. 저장소가 없거나 쓰기가 예외를 던지면(접근 불가, 사생활 보호 모드, 용량 초과) false. */
export function writeStorage(storage, key, value) {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 저장 공간이 모자라서 난 예외인지. 브라우저마다 이름·코드가 다르다:
 * 크롬·사파리 QuotaExceededError(code 22), 예전 파이어폭스 NS_ERROR_DOM_QUOTA_REACHED(code 1014).
 */
export function isQuotaError(error) {
  if (!error || typeof error !== "object") return false;
  return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014;
}

/**
 * 프로필을 바꾼 상태(next)를 저장해 보고 결과를 돌려준다.
 * - "saved": 저장됐다.
 * - "memory": 저장소를 아예 쓸 수 없다(접근 불가, 사생활 보호 모드). 이번 방문 동안만 화면에 반영하고 위쪽 안내로 알린다.
 * - "photo-too-big": 저장소는 쓸 수 있는데 새 사진 때문에 공간이 모자란다. 사진을 상태에 넣으면 그 뒤 모든 기록 저장이
 *   계속 실패하므로 반영하지 않는다.
 * - "storage-full": 저장소는 쓸 수 있는데 사진을 바꾸지 않았는데도 공간이 모자란다. 같은 이유로 반영하지 않는다.
 * 용량 예외만으로는 두 경우를 가를 수 없다(예전 사파리 사생활 보호 모드는 모든 쓰기에 QuotaExceededError를 던진다).
 * 그래서 지금 상태(current, 이미 저장돼 있던 기록)를 다시 써 보고, 그것도 안 되면 저장소 자체가 막힌 것으로 본다.
 */
export function writeProfile(storage, key, { next, current, photoChanged }) {
  if (!storage) return "memory";
  try {
    storage.setItem(key, JSON.stringify(next));
    return "saved";
  } catch (error) {
    if (!isQuotaError(error)) return "memory";
    if (!writeStorage(storage, key, JSON.stringify(current))) return "memory";
    return photoChanged ? "photo-too-big" : "storage-full";
  }
}

/**
 * 저장을 시도할 때마다 안내 상태를 정한다: "hidden"(안 보임) | "shown"(보임) | "closed"(사용자가 닫음).
 * 저장에 실패하면 보이고, 다시 저장되면 숨긴다. 사용자가 닫으면 이번 방문 동안은 저장을 다시 시도해도 계속 닫아 둔다
 * (닫았다는 표시는 저장소가 막혀 있으니 메모리에만 둔다).
 */
export function storageNotice(notice, saved) {
  if (notice === "closed") return notice;
  return saved ? "hidden" : "shown";
}
