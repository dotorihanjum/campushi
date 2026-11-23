import test from "node:test";
import assert from "node:assert/strict";
import { authReturn, expectsAccount, loginRequest, rememberSignIn, SIGNED_IN_KEY } from "./login.js";

test("로그인 뒤 복귀 화면은 앱 안의 허용된 화면만 사용한다", () => {
  assert.deepEqual(authReturn("?auth=success&view=my"), { result: "success", view: "my" });
  assert.equal(authReturn("?auth=success&view=https://evil.example").view, "my");
});
test("로그인 API 오류를 표시하고 토큰을 따로 저장하지 않는다", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "/api/auth/start"); assert.equal(init.credentials, "same-origin");
    return new Response(JSON.stringify({ detail: "다시 로그인해 주세요." }), { status: 401 });
  });
  await assert.rejects(loginRequest("/auth/start", "POST", { provider: "google" }), (e) => e.status === 401);
});

test("#95 로그인한 적이 없는 기기는 로그인 확인을 기다리지 않는다", () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  assert.equal(expectsAccount(storage, ""), false);
  assert.equal(expectsAccount(null, ""), false);
  // 로그인하고 돌아온 주소는 표시가 없어도 계정 기록을 기다린다.
  assert.equal(expectsAccount(storage, "?auth=success&view=my"), true);
  rememberSignIn(storage, true);
  assert.equal(data.get(SIGNED_IN_KEY), "1");
  assert.equal(expectsAccount(storage, ""), true);
  rememberSignIn(storage, false);
  assert.equal(expectsAccount(storage, ""), false);
  const blocked = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("SecurityError"); } };
  assert.equal(expectsAccount(blocked, ""), false);
  assert.doesNotThrow(() => rememberSignIn(blocked, true));
  assert.doesNotThrow(() => rememberSignIn(null, false));
});
