// 웹/파이선프로그래밍 체험: 설명에 알맞은 파이썬 함수 블록을 빈칸으로 끌어다 놓는다(2026-11-10 사용자가 준 예시 그대로).
//
// 근거(경희대 수강신청 사이트 공개 강의계획서 2026-2 SWCON10400, 2026-11-10 확인): 주별 강의 1주 "Setting up Python development
// evironment", 2주 "Variables Data Types (Numeric, String)", 3주 "Data Types (List, Tuple, Set, Dictionary)", 6주 "Function".
// 다른 분반 SWCON10402는 소프트웨어융합대학 학생의 수강을 막아 컴퓨터공학과 학생이 들을 수 없어 근거로 쓰지 않는다.
//
// 체험 설계 원칙(docs/experience-principles.md): 함수 이름이 영어 단어(length·split·upper·print·count)라 처음 봐도 추론해서 풀 수 있다.
// 다 맞히면 실제로 실행한 결과를 보여 주고, "메서드" 같은 대학 용어는 끝난 뒤 이름표로만 붙인다.

export const pythonFunctions = {
  id: "python-functions",
  // 별도 에이전트 검토(고1 적합성 포함)를 통과하면 verified로 바꾼다(labs/index.js).
  status: "verified",
  since: 1,
  title: "알맞은 함수 고르기",
  // 배우기 단계.
  learn:
    "웹/파이선프로그래밍은 파이썬이라는 프로그래밍 언어로 프로그램을 짜는 기초를 배우고, 나중에는 웹페이지까지 만들어 보는 수업이에요. 파이썬에는 자주 하는 일을 대신해 주는 명령이 이름을 달고 준비되어 있는데, 이걸 함수라고 불러요. 글자들을 이어 놓은 것을 문자열, 여러 값을 모아 둔 목록을 리스트라고 해요.",
  task: "설명을 읽고 알맞은 함수 블록을 빈칸으로 끌어다 놓아요. 함수 이름은 영어 단어라 뜻을 떠올리면 찾을 수 있어요.",
  // 끝 화면: 이 수업을 한 문장으로, 고등학교 내용과의 연결, 대학 용어 이름표.
  takeaway: "이 수업은 파이썬으로 글자와 숫자를 다루는 프로그램을 직접 짜 보고, 학기 후반에는 내 소개 웹사이트까지 만들어 보는 수업이에요.",
  link: "수학 시간에 배운 함수 f(x)처럼, len()에 \"campus hi\"를 넣으면 정해진 규칙대로 9가 나와요(띄어쓰기도 한 글자로 세요). 같은 값을 넣으면 언제나 같은 결과가 나오는 것도 수학 함수와 같아요.",
  nameTag: "\"hi\".upper()처럼 값 뒤에 점을 찍어 쓰는 함수(split()·upper()·count())는 대학에서 '메서드'라고 불러요.",
  source: "2026-2 웹/파이선프로그래밍 강의계획서(SWCON10400)의 2주 문자열(String)·3주 리스트(List)·6주 함수(Function)",
  prompt: "다음 설명에 알맞은 함수를 골라요.",
  // 문항 순서대로. block은 보기 블록에 쓰는 글자, hint는 틀렸을 때 보여 주는 힌트,
  // run·out은 다 맞힌 뒤 보여 주는 실제 실행 예와 그 결과(파이썬 3에서 실제로 나오는 값).
  items: [
    { id: "len", text: "입력 문자열의 길이 반환", block: "len()", hint: "len은 length(길이)를 줄인 말이에요.", run: 'len("campus hi")', out: "9" },
    {
      id: "split",
      text: "공백을 기준으로 끊어낸 리스트 반환",
      block: "split()",
      hint: "split은 '쪼개다'라는 뜻이에요.",
      run: '"I like python".split()',
      out: "['I', 'like', 'python']",
    },
    { id: "upper", text: "모든 문자열의 글자 대문자화", block: "upper()", hint: "upper는 '위쪽'이라는 뜻이에요. 대문자를 영어로 uppercase라고 해요.", run: '"hi".upper()', out: "'HI'" },
    { id: "print", text: "출력", block: "print()", hint: "print는 '인쇄하다'라는 뜻이에요. 파이썬에서는 화면에 글자를 찍어 보여 줘요.", run: 'print("안녕")', out: "안녕" },
    { id: "count", text: "문자열에서 사용된 개수", block: "count()", hint: "count는 '세다'라는 뜻이에요.", run: '"banana".count("a")', out: "3" },
  ],
};
