import { lazy } from "react";

// 과목 체험 화면. 그 과목에 들어갈 때만 불러온다(첫 화면 번들에 넣지 않는다). 키는 labs/index.js의 체험 id다.
export const LAB_SCREENS = {
  "python-functions": lazy(() => import("./python-functions/Lab.jsx")),
  "stack-queue": lazy(() => import("./stack-queue/Lab.jsx")),
};
