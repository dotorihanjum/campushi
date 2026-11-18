import test from "node:test";
import assert from "node:assert/strict";
import { openStorage, storageNotice, writeStorage } from "./storage.js";
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
