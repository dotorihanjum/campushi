// 웹/파이선프로그래밍 실습의 순수 로직: 미리보기 문서 만들기, 채점, 명도 대비 계산.
// 사용자가 쓴 HTML·CSS·JS는 sandbox="allow-scripts" iframe(같은 출처 권한 없음)에서만 실행한다. 이 파일은 그 iframe에 넣을
// 문서를 문자열로 만들 뿐 실행하지 않는다.

// 미리보기 안에서 외부 스크립트·스타일·글꼴을 불러오지 못하게 막는다(이미지는 https와 data:만).
export const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; font-src data:";

/** "rgb(1, 2, 3)" · "rgba(1, 2, 3, 0.5)" → [r, g, b, a]. 읽을 수 없으면 null. 미리보기 안에서도 쓰므로 바깥 이름을 쓰지 않는다. */
export function parseColor(value) {
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(String(value).trim());
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return [Number(m[1]), Number(m[2]), Number(m[3]), Math.min(1, Math.max(0, alpha))];
}

/** WCAG 2 명도 대비([r, g, b] 두 색). 1 ~ 21. 미리보기 안에서도 쓰므로 바깥 이름을 쓰지 않는다. */
export function contrastRatio(a, b) {
  const lum = ([r, g, bl]) =>
    [r, g, bl]
      .map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * 미리보기 iframe 안에서 도는 검사기. mode가 "check"면 페이지를 실제로 그린 뒤 채점 항목을 검사하고(버튼도 눌러 본다),
 * "view"면 사용자가 보는 화면이라 콘솔 출력과 오류만 바깥으로 알린다. 링크를 누르면 미리보기 밖으로 나가지 않게 막는다.
 * 미리보기 안에서 문자열로 다시 만들어 실행하므로, 바깥 이름은 인자로 받은 것만 쓴다.
 */
function checker(token, mode, parseColor, contrastRatio) {
  const post = (data) => parent.postMessage(Object.assign({ channel: token }, data), "*");
  const say = (level, args) => {
    const text = args
      .map((arg) => {
        if (typeof arg === "string") return arg;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(" ")
      .slice(0, 300);
    post({ type: "console", level, text });
  };
  let errors = 0;
  addEventListener("error", (event) => {
    errors += 1;
    say("error", [event.message || "스크립트 오류"]);
  });
  addEventListener("unhandledrejection", (event) => {
    errors += 1;
    say("error", [String(event.reason && event.reason.message ? event.reason.message : event.reason)]);
  });
  if (mode === "view")
    for (const level of ["log", "info", "warn", "error"]) {
      const original = console[level];
      console[level] = (...args) => {
        say(level, args);
        original.apply(console, args);
      };
    }
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!link) return;
      event.preventDefault();
      if (mode === "view") post({ type: "link", href: link.getAttribute("href").slice(0, 200) });
    },
    true,
  );
  if (mode !== "check") return;

  const hasText = (el) => !!el && el.textContent.trim().length > 0;
  const style = (el) => getComputedStyle(el);
  // 요소 뒤에 실제로 보이는 배경색: 위(html)부터 요소까지 반투명 배경을 흰 바탕 위에 차례로 겹친다.
  const backdrop = (el) => {
    const chain = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) chain.unshift(parseColor(style(node).backgroundColor));
    return chain.reduce(
      (base, color) => (color ? base.map((v, i) => color[i] * color[3] + v * (1 - color[3])) : base),
      [255, 255, 255],
    );
  };
  const run = () => {
    const results = {};
    const h1 = document.querySelector("h1");
    const paragraphs = [...document.querySelectorAll("p")].filter(hasText);
    results.h1 = hasText(h1);
    results.p = paragraphs.length > 0;
    results.list = [...document.querySelectorAll("ul, ol")].some((list) => [...list.querySelectorAll(":scope > li")].filter(hasText).length >= 2);
    results.link = [...document.querySelectorAll("a[href]")].some((a) => a.getAttribute("href").trim() && hasText(a));
    results.title = document.title.trim().length > 0;
    // 배경 그림·그라디언트(background-image)가 있는지: 색을 계산할 수 없어 대비는 검사하지 않고 통과로 본다.
    const pictured = (el) => {
      for (let node = el; node && node.nodeType === 1; node = node.parentElement) if (style(node).backgroundImage !== "none") return true;
      return false;
    };
    // 글자가 실제로 보이는 진하기: 글자색의 투명도에 요소와 조상들의 opacity를 곱한다.
    const ink = (el) => {
      let alpha = 1;
      for (let node = el; node && node.nodeType === 1; node = node.parentElement) alpha *= parseFloat(style(node).opacity) || 0;
      return alpha;
    };
    const page = backdrop(document.body);
    results.background = page.some((v) => Math.round(v) !== 255) || pictured(document.body);
    results.headingColor = !!h1 && (() => {
      const color = parseColor(style(h1).color);
      return !!color && (color[0] !== 0 || color[1] !== 0 || color[2] !== 0);
    })();
    // 기본 글자 크기(본문 16px, 맨 위 h1 32px)에서 바꿨는지.
    const sized = [document.body, ...paragraphs, ...document.querySelectorAll("li")].some((el) => style(el).fontSize !== "16px");
    results.fontSize = sized || (!!h1 && style(h1).fontSize !== "32px");
    results.contrast =
      paragraphs.length > 0 &&
      paragraphs.every((p) => {
        if (pictured(p)) return true;
        const color = parseColor(style(p).color);
        if (!color) return false;
        // 반투명한 글자는 배경 위에 겹친 색으로 본다.
        const under = backdrop(p);
        const alpha = color[3] * ink(p);
        const seen = under.map((v, i) => color[i] * alpha + v * (1 - alpha));
        return contrastRatio(seen, under) >= 4.5;
      });
    const buttons = [...document.querySelectorAll("button")];
    results.button = buttons.length > 0;
    let changed = false;
    const observer = new MutationObserver(() => {
      changed = true;
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
    for (const button of buttons) {
      try {
        button.click();
      } catch {
        errors += 1;
      }
    }
    setTimeout(() => {
      observer.disconnect();
      results.click = changed;
      results.noError = errors === 0;
      post({ type: "result", results });
    }, 80);
  };
  addEventListener("load", () => setTimeout(run, 30));
}

const STYLE_LINK = /<link\b[^>]*\bhref\s*=\s*["']?style\.css["']?[^>]*>/i;
const SCRIPT_TAG = /<script\b[^>]*\bsrc\s*=\s*["']?script\.js["']?[^>]*>\s*<\/script\s*>/i;

/**
 * 미리보기 iframe에 넣을 문서. index.html이 style.css·script.js를 불러오는 자리에 그 내용을 넣는다(불러오는 줄을 지우면
 * 실제 브라우저처럼 적용되지 않는다). 맨 앞에는 보안 정책과 검사기를 넣는다(<!DOCTYPE> 뒤라 표준 모드 그대로다).
 */
export function buildDocument(files, token, mode) {
  const css = String(files.css ?? "").replace(/<\/style/gi, "<\\/style");
  const js = String(files.js ?? "").replace(/<\/script/gi, "<\\/script");
  let html = String(files.html ?? "")
    .replace(STYLE_LINK, () => `<style>${css}</style>`)
    .replace(SCRIPT_TAG, () => `<script>${js}</script>`);
  const head =
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    `<script>(${checker.toString()})(${JSON.stringify(token)}, ${JSON.stringify(mode)}, ${parseColor.toString()}, ${contrastRatio.toString()});</script>`;
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  return doctype ? doctype[0] + head + html.slice(doctype[0].length) : head + html;
}

/** 채점 결과 → 성적 점수({ correct, total }). results에 없는 항목은 통과하지 못한 것으로 본다. */
export function scoreOf(checks, results) {
  return { correct: checks.filter((check) => results?.[check.id] === true).length, total: checks.length };
}

/** 미션의 필수 항목을 모두 통과했는지. */
export const missionDone = (checks, results, mission) =>
  checks.filter((check) => check.mission === mission && check.core).every((check) => results?.[check.id] === true);

/**
 * 스니펫을 넣을 자리. 커서 위치가 있으면 그 자리, 없으면 index.html은 <body> 안 마지막(script.js 불러오는 줄 앞),
 * 다른 파일은 끝이다.
 */
export function insertAt(text, cursor, fileId) {
  if (Number.isInteger(cursor) && cursor >= 0 && cursor <= text.length) return cursor;
  if (fileId === "html") {
    const at = text.search(/[ \t]*<script\b[^>]*src\s*=\s*["']?script\.js/i);
    if (at >= 0) return at;
    const end = text.search(/<\/body>/i);
    if (end >= 0) return end;
  }
  return text.length;
}
