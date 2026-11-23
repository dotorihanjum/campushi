// 커뮤니티 탭 미리보기용 예시 데이터. 서버·DB가 없어서 화면 디자인을 검토하려고 넣은 예시이고, 실제 사용자의 글이 아니다.
// 닉네임은 모두 지어낸 것이고 실명·사진·연락처는 넣지 않는다. 학과는 앱에 실제로 있는 두 학과(khu-cse, khu-id)만 쓴다.
// minutesAgo: 화면을 연 때로부터 몇 분 전에 쓴 글처럼 보일지. 댓글의 mentor: 그 댓글을 쓴 예시 재학생(MOCK_MENTORS의 id).
// 예시 재학생은 가상 인물이라 수업을 겪은 것처럼 말하거나 교과목 사실을 주장하지 않는다(어디서 확인하는지만 알려 준다).
// (미리보기 브랜치 전용. 실제 커뮤니티를 열 때는 이 파일을 지우고 서버 데이터로 바꾼다.)

export const MOCK_QUESTIONS = [
  {
    id: "q1",
    dept: "khu-cse",
    author: "새내기다람쥐",
    minutesAgo: 25,
    title: "컴공 1학년 수학 진짜 많이 해요?",
    body: "미분적분학, 선형대수, 이산구조가 다 1학년에 있던데 수학을 잘 못하면 많이 힘들까요? 코딩은 좋아하는데 수학은 중간 정도예요.",
    comments: [
      { id: "q1c1", author: "공대생도토리", mentor: "m1", minutesAgo: 12, body: "학년별로 어떤 과목을 듣는지는 학과 홈페이지의 교육과정표에 나와 있어요. 앱의 학년별 과목 목록에서도 볼 수 있어요." },
      { id: "q1c2", author: "고2진로탐색", minutesAgo: 5, body: "저도 궁금했어요. 앱에서 이산구조 퀴즈 풀어 봤는데 생각보다 재밌었어요." },
    ],
  },
  {
    id: "q2",
    dept: "khu-id",
    author: "그림그리는고2",
    minutesAgo: 70,
    title: "산업디자인과는 실기 못 해도 갈 수 있나요?",
    body: "그림은 좋아하는데 학원은 안 다녀 봤어요. 산업디자인학과 들어가면 처음부터 다 배우는 건지 궁금해요.",
    comments: [{ id: "q2c1", author: "스케치하는부엉이", mentor: "m2", minutesAgo: 40, body: "입시 방식은 학교 입학처 요강을 꼭 확인해 보세요. 학교마다 달라요." }],
  },
  {
    id: "q3",
    dept: "khu-cse",
    author: "고1진로고민중",
    minutesAgo: 180,
    title: "정렬 체험 해 봤는데 이게 실제 수업이랑 비슷해요?",
    body: "앱에서 정렬 5라운드 해 봤는데 재밌었어요. 실제 알고리즘 수업도 이런 걸 배우나요?",
    comments: [
      { id: "q3c1", author: "공대생도토리", mentor: "m1", minutesAgo: 150, body: "과목마다 무엇을 배우는지는 학교 강의계획서에 나와 있어요. 궁금한 과목 이름으로 찾아보면 좋아요." },
    ],
  },
  {
    id: "q4",
    dept: "khu-id",
    author: "디자인궁금이",
    minutesAgo: 300,
    title: "산디는 시각디자인이랑 뭐가 달라요?",
    body: "둘 다 디자인인데 산업디자인은 제품을 만드는 거고 시각디자인은 포스터 같은 거라고 들었어요. 맞나요?",
    comments: [],
  },
  {
    id: "q5",
    dept: "khu-cse",
    author: "새벽코딩러",
    minutesAgo: 600,
    title: "문과인데 컴공 가도 괜찮을까요?",
    body: "고등학교는 문과 과목 위주로 들었는데 프로그래밍이 재밌어서 컴공을 생각 중이에요. 따라갈 수 있을지 걱정돼요.",
    comments: [
      { id: "q5c1", author: "새내기탈출판다", mentor: "m5", minutesAgo: 540, body: "걱정되는 과목이 있으면 학과 교육과정표에서 과목 이름을 먼저 확인해 보세요." },
      { id: "q5c2", author: "고1진로고민중", minutesAgo: 500, body: "저도 문과인데 같은 고민이에요ㅠㅠ" },
    ],
  },
  {
    id: "q6",
    dept: "khu-id",
    author: "만들기좋아",
    minutesAgo: 1440,
    title: "산디 과제는 주로 혼자 해요, 팀으로 해요?",
    body: "팀플이 많다고 들었는데 실제로 어떤지 궁금해요.",
    comments: [{ id: "q6c1", author: "목업장인고슴도치", mentor: "m4", minutesAgo: 1300, body: "과목마다 달라서, 궁금한 과목의 강의계획서에서 평가 방법을 확인해 보세요." }],
  },
  {
    id: "q7",
    dept: "khu-cse",
    author: "로봇덕후",
    minutesAgo: 2880,
    title: "컴공에서 인공지능도 배우나요?",
    body: "AI 쪽으로 가고 싶은데 컴퓨터공학과에서 배울 수 있는지 궁금해요.",
    comments: [],
  },
  {
    id: "q8",
    dept: "khu-id",
    author: "그림그리는고2",
    minutesAgo: 4320,
    title: "졸업작품 체험에서 색칠하는 거 해 봤어요",
    body: "산업디자인종합설계 체험 끝까지 해 봤는데 실제 졸업작품은 얼마나 걸리는지 궁금해요.",
    comments: [{ id: "q8c1", author: "디자인궁금이", minutesAgo: 4000, body: "저도 해 봤는데 끝까지 하니까 뿌듯하더라고요." }],
  },
  {
    id: "q9",
    dept: "khu-cse",
    author: "고3마지막고민",
    minutesAgo: 7200,
    title: "컴공이랑 소프트웨어융합 중에 고민돼요",
    body: "둘 다 코딩을 배운다고 하는데 어떤 차이가 있는지 모르겠어요.",
    comments: [],
  },
];

export const MOCK_MENTORS = [
  {
    id: "m1",
    nickname: "공대생도토리",
    dept: "khu-cse",
    year: 3,
    intro: "알고리즘이랑 웹 개발을 좋아해요. 컴공이 궁금하면 편하게 물어보세요.",
    topics: [["진로", "컴공에 관심이 생긴 계기"], ["관심", "알고리즘·웹 개발"]],
  },
  {
    id: "m2",
    nickname: "스케치하는부엉이",
    dept: "khu-id",
    year: 2,
    intro: "제품 디자인 과제와 포트폴리오 얘기 편하게 물어보세요.",
    topics: [["과제", "제품 디자인 과제"], ["준비", "포트폴리오 시작하기"]],
  },
  {
    id: "m3",
    nickname: "AI공부하는여우",
    dept: "khu-cse",
    year: 4,
    intro: "인공지능에 관심이 많아요. 진로 고민을 같이 나눠요.",
    topics: [["관심", "인공지능"], ["진로", "진로 고민"]],
  },
  {
    id: "m4",
    nickname: "목업장인고슴도치",
    dept: "khu-id",
    year: 3,
    intro: "모형 만들기와 팀 프로젝트가 궁금하면 물어보세요.",
    topics: [["실습", "모형 만들기"], ["과제", "팀 프로젝트"]],
  },
  {
    id: "m5",
    nickname: "새내기탈출판다",
    dept: "khu-cse",
    year: 2,
    intro: "문과에서 컴공 온 경험을 이야기해 드려요.",
    topics: [["진로", "문과에서 컴공 오기"], ["생활", "1학년 생활"]],
  },
];
