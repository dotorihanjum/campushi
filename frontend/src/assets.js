// 디자인 시안(@2x, 402×874 아트보드)에서 그대로 뽑아낸 이미지.
import mascotSplash from "./assets/mascot-splash.png";
import wordmark from "./assets/wordmark.png";
import mascotWelcome from "./assets/mascot-welcome.png";
import mascotHome from "./assets/mascot-home.png";
import mascotGrad from "./assets/mascot-grad.png";
// 학년별 캐릭터: 피그마 디자인 파일(릿톤, export 페이지 Design System 슬라이드)의 벡터를 SVG로 내보낸 것(배경만 지움).
import characterGrade1 from "./assets/character-grade1.svg";
import characterGrade2 from "./assets/character-grade2.svg";
import characterGrade3 from "./assets/character-grade3.svg";
import characterGrade4 from "./assets/character-grade4.svg";
import khuLogo from "./assets/khu-logo.png";
import seal from "./assets/seal.png";
import paperFold from "./assets/paper-fold.png";
import sceneSand from "./assets/scene-sand.webp";
import scenePaint from "./assets/scene-paint.webp";
import gradeAplus from "./assets/grade-aplus.png";
import gradeSign from "./assets/grade-sign.png";
import icBack from "./assets/ic-back.png";
import icCap from "./assets/ic-cap.png";
import icHome from "./assets/ic-home.png";
import icCommunity from "./assets/ic-community.svg";
import icMajor from "./assets/ic-major.png";
import icMy from "./assets/ic-my.png";
import c0 from "./assets/conf6-0.png";
import c1 from "./assets/conf6-1.png";
import c2 from "./assets/conf6-2.png";
import c3 from "./assets/conf6-3.png";
import c4 from "./assets/conf6-4.png";
import c5 from "./assets/conf6-5.png";
import c6 from "./assets/conf6-6.png";
import c7 from "./assets/conf6-7.png";
import c8 from "./assets/conf6-8.png";

export const img = {
  mascotSplash,
  wordmark,
  mascotWelcome,
  mascotHome,
  mascotGrad,
  khuLogo,
  seal,
  paperFold,
  sceneSand,
  scenePaint,
  gradeAplus,
  gradeSign,
};

export const icon = {
  back: icBack,
  cap: icCap,
  home: icHome,
  community: icCommunity,
  major: icMajor,
  my: icMy,
};

/** 색종이 조각과 아트보드 위의 자리(논리 px). */
export const confetti = [
  { src: c0, x: 122, y: 97, w: 15, h: 18.5 },
  { src: c1, x: 250.5, y: 117, w: 18.5, h: 22.5 },
  { src: c2, x: 127.5, y: 120.5, w: 18, h: 16 },
  { src: c3, x: 216, y: 126, w: 16.5, h: 18 },
  { src: c4, x: 260, y: 142, w: 13, h: 15.5 },
  { src: c5, x: 305.5, y: 164, w: 22.5, h: 28 },
  { src: c6, x: 73, y: 173, w: 13.5, h: 16 },
  { src: c7, x: 338, y: 192, w: 11.5, h: 19 },
  { src: c8, x: 53.5, y: 215, w: 19.5, h: 31.5 },
];

// 학년별 캐릭터(디자인 시스템 "학년이 올라갈수록 캐릭터도 함께 자라요"). 학년이 열릴 때마다 바뀐다.
export const YEAR_CHARACTERS = [
  { src: characterGrade1, alt: "1학년 새내기 캐릭터" },
  { src: characterGrade2, alt: "2학년 공부하는 캐릭터" },
  { src: characterGrade3, alt: "3학년 커피 마시는 캐릭터" },
  { src: characterGrade4, alt: "4학년 학사모 쓴 캐릭터" },
];
export const yearCharacter = (year) => YEAR_CHARACTERS[Math.min(Math.max(year, 1), 4) - 1];
