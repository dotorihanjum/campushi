// 학과군별 체험 데이터: practice(실습 과목의 체험)와 final(졸업 과제). 이 서비스는 컴퓨터·AI(컴퓨터공학과)와 디자인·미술(산업디자인학과) 두 학과군만 쓴다.
// 형식은 experiences.js의 틀 형식과 같다. base가 있으면 experiences.js의 체험을 바탕으로 쓰고 덧붙인 필드로 덮어쓴다.
// status: "review"(검토 대기) | "verified"(공개). AI가 쓴 데이터는 쓰지 않은 별도 에이전트가 검토한 뒤에만 verified로 바꾼다.
// 아래 4건은 이전 서비스(campus_hi)에서 별도 에이전트 검토를 통과한 그대로다.
// 내용은 표준 교재·일반적인 학과 과정에 공통으로 나오는 것만 쓴다.

export const groupData = {
  computing: {
    practice: {
      status: "verified",
      base: "sorting",
      learn: "컴퓨터는 많은 데이터를 정해진 순서대로 정리하는 일을 자주 해요. 정렬 방법마다 필요한 횟수가 달라서, 어떤 방법을 고르느냐가 프로그램의 빠르기를 좌우해요.",
    },
    // 졸업프로젝트(4학년 2학기): AI 반려동물 사진 분류 앱을 학습시키고 출시해본다(틀 G, experiences.js의 petClassifier).
    // 4학년 1학기에 고를 수 있는 '캡스톤디자인' 과목과 헷갈리지 않게 제목은 졸업 과제 과목 이름에 맞춘다.
    final: {
      status: "verified",
      base: "petClassifier",
      title: "졸업 프로젝트",
    },
  },
  design: {
    // 장면에서 찾기(E)는 그림이 준비되면 바꾼다. 그동안은 순서 맞추기로 디자인 과정을 체험한다.
    practice: {
      status: "verified",
      template: "B",
      title: "디자인 과정",
      task: "사용자의 불편에서 출발해 해결책을 내놓는 단계를 순서대로 놓아요.",
      learn: "디자이너는 먼저 사용자를 관찰해 문제를 넓게 찾고, 핵심 문제를 정한 뒤 아이디어를 만들어 시험해요. 영국 디자인 카운슬은 이를 더블 다이아몬드로 정리했어요.",
      swap: "move",
      prompt: "더블 다이아몬드의 네 단계를 순서대로 놓아요.",
      items: ["발견: 사용자 관찰하기", "정의: 핵심 문제 정하기", "개발: 아이디어 만들고 시험하기", "전달: 완성해 내놓기"],
      explanation: "더블 다이아몬드는 발견에서 생각을 넓혔다가 정의에서 좁히고, 개발에서 다시 넓혔다가 전달에서 좁혀요.",
    },
    final: { status: "verified", base: "artwork" },
  },
};
