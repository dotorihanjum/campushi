import test from "node:test";
import assert from "node:assert/strict";
import { LOAD_FAILED, canShareFile, isAbort, retryBy, singleFlight } from "./certificateSave.js";
import { certificateFileName } from "./screens/reportFileName.js";

test("증명서 파일 이름은 캠퍼스하이_학교_학과_증명서종류_YYYY-MM-DD.png이다", () => {
  const now = new Date(2026, 10, 19, 15, 0);
  assert.equal(certificateFileName("경희대학교", "컴퓨터공학과", "졸업증명서", now), "캠퍼스하이_경희대학교_컴퓨터공학과_졸업증명서_2026-11-19.png");
  assert.equal(certificateFileName("경희대학교", "산업디자인학과", "입학증", now), "캠퍼스하이_경희대학교_산업디자인학과_입학증_2026-11-19.png");
  assert.equal(certificateFileName("경희대학교", "컴퓨터공학과", "성적표", now), "캠퍼스하이_경희대학교_컴퓨터공학과_성적표_2026-11-19.png");
});

test("증명서 파일 이름의 날짜는 기기 로컬 날짜다(UTC로 바꾸면 전날이 되는 이른 아침도)", () => {
  // 한국 시간 오전 0시 30분은 UTC로 전날 15시 30분이다. 기기 시간대와 상관없이 로컬 날짜 칸을 그대로 써야 한다.
  const early = new Date(2026, 0, 1, 0, 30);
  assert.ok(certificateFileName("학교", "학과", "입학증", early).endsWith("_2026-01-01.png"));
  const late = new Date(2026, 11, 31, 23, 59);
  assert.ok(certificateFileName("학교", "학과", "입학증", late).endsWith("_2026-12-31.png"));
});

test("증명서 파일 이름도 리포트와 같이 못 쓰는 문자와 공백을 '-'로 바꾸고 빈 칸은 뺀다", () => {
  const now = new Date(2026, 10, 19);
  assert.equal(certificateFileName("경희 대학교", "컴퓨터/공학:과", "졸업증명서", now), "캠퍼스하이_경희-대학교_컴퓨터-공학-과_졸업증명서_2026-11-19.png");
  assert.equal(certificateFileName("", "  ", "입학증", now), "캠퍼스하이_입학증_2026-11-19.png");
  assert.equal(certificateFileName("..학교..", 'a*?"<>|b', "성적표", now), "캠퍼스하이_학교_a-b_성적표_2026-11-19.png");
});

const file = { name: "a.png" };

test("공유는 share와 canShare가 있고 canShare({ files })가 true일 때만 된다", () => {
  let asked = null;
  const ok = { share() {}, canShare: (data) => ((asked = data), true) };
  assert.equal(canShareFile(ok, file), true);
  assert.deepEqual(asked, { files: [file] });
  assert.equal(canShareFile({ share() {}, canShare: () => false }, file), false);
  // canShare가 true가 아닌 값(문자열·1)을 돌려줘도 공유하지 않는다.
  assert.equal(canShareFile({ share() {}, canShare: () => "true" }, file), false);
  // 공유 창은 있지만 파일 공유를 물어볼 수 없는 브라우저(canShare 없음)와 공유 창이 없는 브라우저.
  assert.equal(canShareFile({ share() {} }, file), false);
  assert.equal(canShareFile({ canShare: () => true }, file), false);
  assert.equal(canShareFile({}, file), false);
  assert.equal(canShareFile(undefined, file), false);
  assert.equal(
    canShareFile({ share() {}, canShare: () => { throw new TypeError("x"); } }, file),
    false,
  );
});

test("공유 창을 닫은 것(AbortError)만 오류 안내에서 뺀다", () => {
  assert.equal(isAbort({ name: "AbortError" }), true);
  for (const error of [{ name: "NotAllowedError" }, new Error("x"), null, undefined, "AbortError"]) assert.equal(isAbort(error), false);
});

test("만드는 동안 여러 번 불러도 파일은 하나만 만들고, 만든 뒤에도 같은 파일을 돌려준다", async () => {
  let made = 0;
  let finish;
  const get = singleFlight(() => {
    made += 1;
    return new Promise((resolve) => (finish = resolve));
  });
  const calls = [get(), get(), get()];
  await Promise.resolve();
  assert.equal(made, 1);
  finish("파일");
  assert.deepEqual(await Promise.all(calls), ["파일", "파일", "파일"]);
  assert.equal(await get(), "파일");
  assert.equal(made, 1);
});

test("만들기에 실패하면 기다리던 쪽 모두 실패를 받고, 다음 호출에서 다시 만든다", async () => {
  let made = 0;
  const get = singleFlight(async () => {
    made += 1;
    if (made === 1) throw new Error("그리기 실패");
    return "파일";
  });
  const [a, b] = [get(), get()];
  await assert.rejects(a, /그리기 실패/);
  await assert.rejects(b, /그리기 실패/);
  assert.equal(made, 1);
  assert.equal(await get(), "파일");
  assert.equal(made, 2);
  assert.equal(await get(), "파일");
  assert.equal(made, 2);
});

test("만드는 함수가 바로 예외를 던져도 Promise 실패로 돌려준다", async () => {
  const get = singleFlight(() => {
    throw new Error("바로 실패");
  });
  await assert.rejects(get(), /바로 실패/);
});

test("도구를 불러오지 못했으면 페이지를 새로 불러 다시 시도하고, 그 밖의 실패는 그 자리에서 다시 그린다", () => {
  assert.equal(retryBy({ code: LOAD_FAILED }), "reload");
  for (const error of [new Error("그리기 실패"), { code: "other" }, null, undefined, { name: "TypeError" }]) assert.equal(retryBy(error), "render");
});
