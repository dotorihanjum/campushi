import { cleanGame } from "./lessonGames.js";

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
  }
}
const FAILED = "학과 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.";
async function request(path, init, signal, failed = FAILED) {
  // AbortSignal.any는 iOS 17.4 미만 Safari에 없어서 직접 묶는다.
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const timer = setTimeout(cancel, 15000);
  if (signal?.aborted) cancel();
  signal?.addEventListener("abort", cancel);
  let response;
  try {
    response = await fetch(`/api${path}`, { ...init, signal: controller.signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, failed);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(response.status, failed);
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      typeof data.detail === "string"
        ? data.detail
        : "요청을 처리하지 못했어요.",
    );
  return data;
}
// 학과 데이터(경희대 컴퓨터공학과·산업디자인학과). 형식은 model.js의 createDepartment가 검사한다.
export async function getDepartments(signal) {
  const data = await request("/departments", { method: "GET" }, signal);
  if (!Array.isArray(data.departments)) throw new ApiError(502, "학과 정보 형식이 올바르지 않아요. 잠시 후 다시 시도해주세요.");
  return data.departments;
}
// 과목의 연습 문제를 받는다. 문제가 없으면 404, 받은 문제의 형식이 맞지 않으면 422 오류를 낸다.
export async function getLessonGame(subject, signal) {
  const data = await request(
    "/lesson_game",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject }) },
    signal,
    "연습 문제를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
  );
  const game = cleanGame(data.game);
  if (!game) throw new ApiError(422, "연습 문제 형식이 올바르지 않아요.");
  return game;
}
