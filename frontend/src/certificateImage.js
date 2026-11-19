// 증명서 종이를 PNG 파일로 그린다(#25). html2canvas-pro는 다시 보기에서 저장할 때만 쓰므로
// 동적 import()로 불러와 첫 화면 번들에 넣지 않는다.
import { LOAD_FAILED } from "./certificateSave.js";

// 화면의 아트보드 1px을 이미지에서 몇 px로 그릴지. 종이 273×365가 819×1095 이미지가 된다.
const SCALE = 3;
// 종이 밖(접힌 모서리·둥근 모서리 뒤)의 색. 다시 보기 화면의 배경과 같다.
const BACKGROUND = "#27d8cd";

/**
 * 복제 문서를 화면과 같은 완성된 모습으로 맞춘다.
 * - 애니메이션: index.css의 .shot이 모든 애니메이션을 0초로 끝까지 돌려 마지막 모습에 멈춘다(열자마자 눌러도 다 그려진 모습).
 * - 확대·축소: 아트보드는 창 크기에 맞춰 transform: scale()로 줄이거나 늘린다. 복제 문서에서 이것을 풀어 아트보드 1px = CSS 1px로 그린다.
 */
function settle(doc, paper) {
  doc.body.classList.add("shot");
  for (let el = paper.parentElement; el && el !== doc.body; el = el.parentElement) {
    if (el.style.transform) el.style.transform = "none";
  }
}

/**
 * 화면에서는 넘치지 않는데 말줄임(text-overflow: ellipsis)이 걸린 요소들(종이 안 순서 번호). 종이의 학교·학과 이름, 입학 일시 줄(T의 clip).
 * 앱 글자에는 letter-spacing: -0.02em이 걸려 있어 화면은 글자 폭을 그만큼 좁게 재고 요소 폭도 거기에 맞춘다.
 * html2canvas-pro는 말줄임을 정할 때 캔버스 measureText로 letter-spacing 없이 재므로(예: 108.4px 칸에 112.2px)
 * 화면에서는 다 보이는 "경희대학교 컴퓨터공학과"를 "컴퓨터공학…"으로 자른다. 이런 요소는 복제 문서에서 말줄임을 끈다.
 * 화면에서도 정말 넘치는 긴 이름은 그대로 말줄임으로 그린다.
 */
function fittingEllipses(paper) {
  return [...paper.querySelectorAll("*")].flatMap((el, i) =>
    getComputedStyle(el).textOverflow === "ellipsis" && el.scrollWidth <= el.clientWidth ? [i] : [],
  );
}

function unclip(clone, fits) {
  const all = clone.querySelectorAll("*");
  for (const i of fits) {
    const el = all[i];
    if (!el) continue;
    el.style.textOverflow = "clip";
    el.style.overflow = "visible";
  }
}

/** 종이 요소(Paper)를 PNG File로 만든다. 실패하면 예외를 던진다. */
export async function renderCertificate(paper, fileName) {
  if (!paper?.isConnected) throw new Error("증명서 종이를 찾지 못했어요.");
  await document.fonts?.ready;
  let html2canvas;
  try {
    ({ default: html2canvas } = await import("html2canvas-pro"));
  } catch (cause) {
    // 브라우저는 실패한 동적 import를 페이지가 살아 있는 동안 기억하므로, 이때 다시 시도는 페이지를 새로 불러야 한다(certificateSave.js의 retryBy).
    throw Object.assign(new Error("이미지 도구를 불러오지 못했어요.", { cause }), { code: LOAD_FAILED });
  }
  // 복제하기 전에 화면에서 잰다(복제 문서는 확대·축소와 애니메이션을 바꾸므로).
  const fits = fittingEllipses(paper);
  const canvas = await html2canvas(paper, {
    scale: SCALE,
    backgroundColor: BACKGROUND,
    logging: false,
    onclone: (doc, clone) => {
      settle(doc, clone);
      unclip(clone, fits);
    },
  });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("이미지 파일을 만들지 못했어요.");
  return new File([blob], fileName, { type: "image/png" });
}

/** 만든 파일을 내려받는다(a[download]). 주소는 내려받기가 시작될 시간을 두고 정리한다. */
export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
