import test from "node:test";
import assert from "node:assert/strict";
import { getDepartments, ApiError } from "./api.js";
import { RAW_CSE } from "./testFixtures.js";

test("학과 데이터는 GET으로 받고, 목록이 아니면 받지 않는다", async (t) => {
  const requests = [];
  let reply = () => new Response(JSON.stringify({ departments: [RAW_CSE] }), { status: 200 });
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push([url, options.method]);
    return reply();
  });
  assert.deepEqual(await getDepartments(), [RAW_CSE]);
  assert.deepEqual(requests, [["/api/departments", "GET"]]);
  for (const body of [{}, { departments: "가" }]) {
    reply = () => new Response(JSON.stringify(body), { status: 200 });
    await assert.rejects(getDepartments(), (error) => error instanceof ApiError && error.status === 502);
  }
});

test("서버 오류와 연결 실패는 한국어 메시지로 알린다", async (t) => {
  let reply = () => new Response(JSON.stringify({ detail: "서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요." }), { status: 500 });
  t.mock.method(globalThis, "fetch", async () => reply());
  await assert.rejects(getDepartments(), (error) => error.status === 500 && /서버에 문제가/.test(error.message));
  reply = () => {
    throw new TypeError("offline");
  };
  await assert.rejects(getDepartments(), (error) => error instanceof ApiError && error.status === 0 && /학과 정보를 불러오지 못했어요/.test(error.message));
  reply = () => new Response("<html>", { status: 502 });
  await assert.rejects(getDepartments(), (error) => error.status === 502);
});

test("가입 제한과 저장 거절 이유를 서버 응답에서 유지한다", async (t) => {
  const { request } = await import("./api.js");
  let payload = { detail: "나이 제한", code: "signup_age_restricted" };
  let status = 403;
  t.mock.method(globalThis, "fetch", async () => Response.json(payload, { status }));
  await assert.rejects(request("/auth/register"), { status, code: "signup_age_restricted", message: "나이 제한" });

  payload = { detail: { code: "record_change_rejected", change_index: 1, message: "과목이 닫혔어요." } };
  status = 400;
  await assert.rejects(request("/me/records/operations"), {
    status, code: "record_change_rejected", changeIndex: 1, message: "과목이 닫혔어요.",
  });
});
