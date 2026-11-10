// 웹/파이선프로그래밍 실습: 자기소개 웹사이트 텀프로젝트(HTML → CSS → JavaScript).
//
// 근거(경희대 수강신청 사이트 공개 강의계획서, 2026-11-10 확인): 2026-2 SWCON10400(박상근) 하나만 쓴다.
// - 수업목표 "3. 웹의 동작 원리 및 HTML, CSS, JavaScript 기본 학습", "5. 자기소개 웹사이트 제작"
// - 과제 "- 데이터 분석 텀프로젝트 수행 - 자기소개 웹사이트 제작 텀프로젝트 수행"
// - 주별 강의: 12주 "Introduction to Web HTML" → 13주 "CSS" → 14주 "JavaScript"
// 다른 분반 SWCON10402(이성원)는 "소프트웨어융합대학/전자공학부를 본전공/다전공 하는 학생의 수강을 금지"해서
// 소프트웨어융합대학 컴퓨터공학부 학생은 들을 수 없고, 텀프로젝트도 없어 근거로 쓰지 않는다.
// 같은 계획서의 데이터 분석 텀프로젝트(11주 "Data analysis using Python (Pandas and Matplotlib)")는 2차로 붙인다(missions에 더하는 구조).
// 수업 실습 자료(github.com/drsungwon/python-tutorial, CC BY-NC 3.0)는 상업적 이용이 안 되어 내용을 가져오지 않았다.
// 과제 문구·스니펫·채점 항목은 이 저장소에서 새로 썼다.

export const webPython = {
  id: "web-python",
  // 별도 에이전트 검토를 통과하면 verified로 바꾼다(labs/index.js).
  status: "verified",
  since: 1,
  title: "자기소개 웹사이트 만들기",
  // 배우기 단계: 이 체험이 실제 수업의 어떤 활동인지.
  learn:
    "웹/파이선프로그래밍은 파이썬 기초를 배운 뒤 웹의 동작 원리와 HTML·CSS·JavaScript를 배워요. 2026년 2학기 박상근 교수 분반(SWCON10400) 강의계획서에는 자기소개 웹사이트를 만드는 텀프로젝트가 있어요.",
  task: "HTML로 내용을 쓰고, CSS로 꾸미고, JavaScript로 버튼을 누르면 반응하게 해서 나만의 자기소개 페이지를 완성해요.",
  // 끝 화면의 한 줄: 이 수업에서 실제로 배우는 것.
  takeaway: "HTML은 내용의 뼈대, CSS는 모양, JavaScript는 동작을 맡는다는 웹의 기본 구조를 직접 만들며 익혀요.",
  // 강의계획서 출처(배우기 단계에 보여 준다).
  source: "2026-2 웹/파이선프로그래밍 강의계획서(SWCON10400)의 수업목표 '자기소개 웹사이트 제작'과 과제 '자기소개 웹사이트 제작 텀프로젝트 수행'",
  files: [
    { id: "html", name: "index.html" },
    { id: "css", name: "style.css" },
    { id: "js", name: "script.js" },
  ],
  // 처음 열었을 때의 파일. index.html이 style.css와 script.js를 불러온다(지우면 실제 브라우저처럼 적용되지 않는다).
  starter: {
    html: `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title></title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <script src="script.js"></script>
</body>
</html>
`,
    css: `/* 여기에 스타일을 써요 */
`,
    js: `// 여기에 동작을 써요
`,
  },
  // 미션은 강의계획서 주차 순서(HTML → CSS → JavaScript)를 따른다. 미션의 필수 항목을 모두 통과해야 다음 미션으로 간다.
  missions: [
    {
      id: "html",
      file: "html",
      label: "HTML",
      goal: "<body> 안에 나를 소개하는 내용을 써요. 큰 제목, 소개 문단, 관심사 목록, 링크가 있어야 해요. <head> 안의 <title></title> 사이에는 브라우저 탭에 보일 이름을 써요.",
      snippets: [
        { label: "큰 제목(h1)", code: "<h1>안녕하세요, 저는 ○○○예요</h1>\n" },
        { label: "문단(p)", code: "<p>저를 소개할게요.</p>\n" },
        { label: "목록(ul)", code: "<ul>\n  <li>관심사 1</li>\n  <li>관심사 2</li>\n</ul>\n" },
        { label: "링크(a)", code: '<a href="https://www.khu.ac.kr">경희대학교</a>\n' },
      ],
    },
    {
      id: "css",
      file: "css",
      label: "CSS",
      goal: "style.css에서 페이지를 꾸며요. 배경, 제목 글자색, 글자 크기를 바꿔 보세요. 글자색과 배경색의 대비가 충분해야 읽기 쉬워요.",
      snippets: [
        { label: "배경색", code: "body {\n  background-color: #fff7e6;\n}\n" },
        { label: "제목 색", code: "h1 {\n  color: #087f77;\n}\n" },
        { label: "글자 크기", code: "p {\n  font-size: 18px;\n}\n" },
        { label: "가운데 정렬", code: "h1 {\n  text-align: center;\n}\n" },
      ],
    },
    {
      id: "js",
      file: "js",
      label: "JavaScript",
      goal: "index.html에 버튼을 넣고(<script> 줄보다 위에), script.js에서 버튼을 누르면 페이지가 바뀌게 해요. 스니펫을 넣으면 누를 때 콘솔에도 글이 나와요.",
      snippets: [
        { label: "버튼(HTML)", file: "html", code: '<button id="hello">인사하기</button>\n' },
        {
          label: "누르면 바꾸기",
          code: 'document.querySelector("#hello").addEventListener("click", (event) => {\n  event.currentTarget.textContent = "반가워요!";\n  console.log("버튼을 눌렀어요");\n});\n',
        },
      ],
    },
  ],
  // 채점 항목. core는 그 미션을 마치는 데 꼭 필요한 항목, 나머지는 더 다듬어 보는 완성도 항목이다.
  // 통과 수는 제출 화면과 기록 요약에만 보이고 성적·해금에는 쓰지 않는다(2026-11-10 사용자 결정, 이수는 끝까지 해보고 기록을 남기면 P).
  // 검사는 미리보기 안에서 실제로 그려진 페이지로 한다(logic.js의 checker).
  checks: [
    { id: "h1", mission: "html", core: true, label: "큰 제목(<h1>)에 글자가 있어요" },
    { id: "p", mission: "html", core: true, label: "소개 문단(<p>)이 있어요" },
    { id: "list", mission: "html", core: true, label: "목록(<ul>·<ol>)에 항목(<li>)이 2개 이상 있어요" },
    { id: "link", mission: "html", core: true, label: '링크(<a href="…">)가 있어요' },
    { id: "title", mission: "html", core: false, label: "브라우저 탭에 보일 제목(<title>)을 정했어요" },
    { id: "background", mission: "css", core: true, label: "페이지 배경을 바꿨어요" },
    { id: "headingColor", mission: "css", core: true, label: "제목 글자색을 바꿨어요" },
    { id: "fontSize", mission: "css", core: true, label: "제목·문단·목록 중 하나의 글자 크기를 바꿨어요" },
    { id: "contrast", mission: "css", core: false, label: "소개 문단의 글자색과 배경색 대비가 4.5:1 이상이에요" },
    { id: "button", mission: "js", core: true, label: "버튼(<button>)이 있어요" },
    { id: "click", mission: "js", core: true, label: "버튼을 누르면 페이지가 바뀌어요" },
    { id: "noError", mission: "js", core: false, label: "실행할 때 오류가 나지 않아요" },
  ],
};
