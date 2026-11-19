// 증명서 이미지 저장·공유(#25)의 화면과 상관없는 규칙. JSX가 없어 node --test로 바로 시험한다.

/**
 * 이 브라우저가 파일을 기기 공유 창으로 보낼 수 있는지. navigator.share와 navigator.canShare가 모두 있고
 * canShare({ files })가 true일 때만 true다. canShare가 예외를 던지면(일부 브라우저) 공유할 수 없는 것으로 본다.
 */
export function canShareFile(navigatorLike, file) {
  if (!navigatorLike || typeof navigatorLike.share !== "function" || typeof navigatorLike.canShare !== "function") return false;
  try {
    return navigatorLike.canShare({ files: [file] }) === true;
  } catch {
    return false;
  }
}

/** 사용자가 공유 창을 닫았을 때 나는 오류인지. 이때는 오류로 안내하지 않는다. */
export const isAbort = (error) => error?.name === "AbortError";

/**
 * 파일을 한 번만 만든다. 만드는 동안 여러 번 불러도 같은 Promise를 돌려주고(연타해도 하나만 만든다),
 * 만든 뒤에는 그 결과를 계속 돌려준다. 만들기에 실패하면 결과를 버려서 다음 호출이 다시 만든다(다시 시도).
 */
export function singleFlight(make) {
  let pending = null;
  return () => {
    if (!pending) {
      pending = Promise.resolve()
        .then(make)
        .catch((error) => {
          pending = null;
          throw error;
        });
    }
    return pending;
  };
}

/** 이미지 도구(html2canvas-pro)를 불러오지 못한 오류의 code(certificateImage.js). */
export const LOAD_FAILED = "load-failed";

/**
 * 이미지 만들기에 실패했을 때 다시 시도하는 방법. 도구를 불러오지 못했으면 브라우저가 실패한 import를 기억하고 있어
 * 같은 페이지에서는 다시 불러도 바로 실패하므로 페이지를 새로 부른다("reload", 다시 보기 화면은 새로고침해도 그대로다).
 * 그 밖의 실패(그리기·파일 만들기)는 그 자리에서 다시 그린다("render").
 */
export const retryBy = (error) => (error?.code === LOAD_FAILED ? "reload" : "render");
