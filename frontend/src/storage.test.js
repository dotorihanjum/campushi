import test from "node:test";
import assert from "node:assert/strict";
import { isQuotaError, openStorage, storageNotice, writeProfile, writeStorage } from "./storage.js";
import { STORAGE_KEY, initialState, loadState } from "./model.js";

// 메모리로 흉내 낸 localStorage. setItem을 바꿔 쓰기가 막힌 브라우저를 만든다.
function memoryStorage(setItem) {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: setItem || ((key, value) => data.set(key, String(value))),
    removeItem: (key) => data.delete(key),
  };
}
const quota = () => {
  throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
};
const insecure = () => {
  throw new DOMException("The operation is insecure.", "SecurityError");
};

// App이 하는 순서대로: 저장소를 열고, 기록을 불러오고, 상태가 바뀔 때마다 저장하며 안내 상태를 정한다.
function visit(get, saves = 1) {
  const storage = openStorage(get);
  const state = loadState(storage);
  let notice = "hidden";
  for (let i = 0; i < saves; i++) notice = storageNotice(notice, writeStorage(storage, STORAGE_KEY, JSON.stringify(state)));
  return { storage, state, notice };
}

test("정상 저장소에서는 기록이 저장되고 안내가 보이지 않는다", () => {
  const local = memoryStorage();
  const { storage, notice } = visit(() => local, 3);
  assert.equal(storage, local);
  assert.equal(notice, "hidden");
  assert.deepEqual(JSON.parse(local.data.get(STORAGE_KEY)), initialState);
});

test("setItem이 예외를 던지면(사생활 보호 모드·용량 초과) 안내가 보인다", () => {
  for (const setItem of [quota, insecure]) {
    const local = memoryStorage(setItem);
    const { state, notice } = visit(() => local);
    assert.deepEqual(state, initialState);
    assert.equal(writeStorage(local, STORAGE_KEY, "{}"), false);
    assert.equal(notice, "shown");
  }
});

test("localStorage에 접근하는 것 자체가 예외를 던지거나 저장소가 없어도 빈 상태로 시작하고 안내가 보인다", () => {
  for (const get of [insecure, () => null, () => undefined]) {
    const { storage, state, notice } = visit(get);
    assert.equal(storage, null);
    assert.deepEqual(state, initialState);
    assert.equal(notice, "shown");
  }
  assert.equal(writeStorage(null, STORAGE_KEY, "{}"), false);
});

test("안내를 닫으면 같은 방문에서는 저장을 다시 시도해도(실패·성공 모두) 다시 나오지 않는다", () => {
  let notice = storageNotice("hidden", false);
  assert.equal(notice, "shown");
  notice = "closed";
  for (const saved of [false, false, true, false]) {
    notice = storageNotice(notice, saved);
    assert.equal(notice, "closed");
  }
  // 닫기 전에 다시 저장되면(공간이 생김) 안내를 숨기고, 또 실패하면 다시 보인다.
  assert.equal(storageNotice("shown", true), "hidden");
  assert.equal(storageNotice("hidden", false), "shown");
});

// 정해진 크기(글자 수)까지만 담는 저장소. 실제 브라우저의 용량 초과처럼 QuotaExceededError를 던진다.
function limitedStorage(limit, error = () => new DOMException("The quota has been exceeded.", "QuotaExceededError")) {
  const storage = memoryStorage((key, value) => {
    if (String(value).length > limit) throw error();
    storage.data.set(key, String(value));
  });
  return storage;
}
const PHOTO = `data:image/jpeg;base64,${"A".repeat(5000)}`;

test("용량 예외는 브라우저마다 다른 이름·코드를 모두 알아본다", () => {
  assert.equal(isQuotaError(new DOMException("full", "QuotaExceededError")), true);
  assert.equal(isQuotaError({ name: "NS_ERROR_DOM_QUOTA_REACHED", code: 1014 }), true);
  assert.equal(isQuotaError({ name: "Error", code: 22 }), true);
  assert.equal(isQuotaError({ name: "Error", code: 1014 }), true);
  assert.equal(isQuotaError(new DOMException("insecure", "SecurityError")), false);
  assert.equal(isQuotaError(new TypeError("x")), false);
  for (const value of [null, undefined, "QuotaExceededError", 22]) assert.equal(isQuotaError(value), false);
});

test("정상 저장소에서는 프로필이 저장되고 다시 불러와도 남는다", () => {
  const local = memoryStorage();
  const current = { ...structuredClone(initialState), onboarded: true };
  const next = { ...current, nickname: "미래의 개발자", profilePhoto: PHOTO };
  assert.equal(writeProfile(local, STORAGE_KEY, { next, current, photoChanged: true }), "saved");
  const loaded = loadState(local);
  assert.equal(loaded.nickname, "미래의 개발자");
  assert.equal(loaded.profilePhoto, PHOTO);
});

test("저장소를 아예 쓸 수 없으면 이번 방문 동안만 반영하고(memory) 위쪽 안내가 보인다. 닫았으면 다시 나오지 않는다", () => {
  const current = { ...structuredClone(initialState), onboarded: true };
  const next = { ...current, nickname: "새 이름", profilePhoto: PHOTO };
  // 접근 불가(SecurityError), 예전 사파리 사생활 보호 모드(모든 쓰기에 QuotaExceededError), 저장소 없음.
  for (const storage of [memoryStorage(insecure), memoryStorage(quota), null]) {
    for (const photoChanged of [true, false]) assert.equal(writeProfile(storage, STORAGE_KEY, { next, current, photoChanged }), "memory");
    // App은 바뀐 상태를 저장하려다 실패하고, 안내 상태를 정한다.
    const saved = writeStorage(storage, STORAGE_KEY, JSON.stringify(next));
    assert.equal(storageNotice("hidden", saved), "shown");
    assert.equal(storageNotice("closed", saved), "closed");
    // 새로고침하면 바뀐 프로필은 없다.
    const reloaded = loadState(storage);
    assert.equal(reloaded.nickname, initialState.nickname);
    assert.equal(reloaded.profilePhoto, null);
  }
});

test("저장소는 되는데 새 사진 때문에 공간이 모자라면 사진을 반영하지 않고, 그 뒤 다른 기록은 계속 저장된다", () => {
  const current = { ...structuredClone(initialState), onboarded: true, nickname: "원래 이름" };
  const base = JSON.stringify(current).length;
  const local = limitedStorage(base + 1000);
  assert.equal(writeStorage(local, STORAGE_KEY, JSON.stringify(current)), true);
  const next = { ...current, nickname: "새 이름", profilePhoto: PHOTO };
  assert.equal(writeProfile(local, STORAGE_KEY, { next, current, photoChanged: true }), "photo-too-big");
  // 저장소에는 이전 기록이 그대로 있다.
  assert.equal(loadState(local).nickname, "원래 이름");
  assert.equal(loadState(local).profilePhoto, null);
  // 사진을 상태에 넣지 않았으므로 그 뒤 입학 같은 기록은 저장되고, 위쪽 안내는 나오지 않는다.
  const after = { ...current, credits: 5, studying: "khu-cse" };
  const saved = writeStorage(local, STORAGE_KEY, JSON.stringify(after));
  assert.equal(saved, true);
  assert.equal(storageNotice("hidden", saved), "hidden");
  assert.equal(loadState(local).credits, 5);
  // 사진을 넣었다면 그 뒤 모든 저장이 실패했을 것이다(이 경우를 막으려고 반영하지 않는다).
  assert.equal(writeStorage(local, STORAGE_KEY, JSON.stringify({ ...after, profilePhoto: PHOTO })), false);
  // 파이어폭스 이름·코드로 던져도 같다.
  const firefox = limitedStorage(base + 1000, () => Object.assign(new Error("full"), { name: "NS_ERROR_DOM_QUOTA_REACHED", code: 1014 }));
  assert.equal(writeProfile(firefox, STORAGE_KEY, { next, current, photoChanged: true }), "photo-too-big");
});

test("사진을 바꾸지 않았는데 공간이 모자라면 storage-full이고, 이전 기록은 그대로다", () => {
  const current = { ...structuredClone(initialState), onboarded: true, nickname: "가" };
  const local = limitedStorage(JSON.stringify(current).length);
  const next = { ...current, nickname: "아주 긴 새 이름입니다" };
  assert.equal(writeProfile(local, STORAGE_KEY, { next, current, photoChanged: false }), "storage-full");
  assert.equal(loadState(local).nickname, "가");
});
