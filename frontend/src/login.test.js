import test from "node:test";
import assert from "node:assert/strict";
import { authReturn, loginRequest } from "./login.js";

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
