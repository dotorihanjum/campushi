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
 * 저장을 시도할 때마다 안내 상태를 정한다: "hidden"(안 보임) | "shown"(보임) | "closed"(사용자가 닫음).
 * 저장에 실패하면 보이고, 다시 저장되면 숨긴다. 사용자가 닫으면 이번 방문 동안은 저장을 다시 시도해도 계속 닫아 둔다
 * (닫았다는 표시는 저장소가 막혀 있으니 메모리에만 둔다).
 */
export function storageNotice(notice, saved) {
  if (notice === "closed") return notice;
  return saved ? "hidden" : "shown";
}
