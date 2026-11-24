// #97 로그인 중 수업의 체험 시도 번호(서버가 발급)를 과목별로 보관한다. 이 번호로 마친 이수에만 크레딧이 쌓인다.
// 수업 화면(screens/Lesson.jsx)의 ref에만 두면 수업을 나갔다 다시 들어올 때 새 번호를 받는데, 이미 체험한 결과(plays)가 있으면
// 다시 들어올 때 기록 단계부터 열리므로 곧바로 "성적 받기"를 누를 수 있다. 그러면 새 번호는 연 지 20초가 안 돼 서버가 크레딧을 거절한다.
// 그래서 화면이 다시 마운트돼도 남는 모듈 수준에 두고, 체험한 결과가 있는 채로 다시 열면 앞의 시도를 이어 쓴다. 이수에 쓰면 지운다.
// 새로고침하면 사라진다(그때는 plays도 메모리에서 사라져 수업을 처음부터 한다). React를 쓰지 않아 테스트(node)에서도 읽는다.
export function createLessonAttempts() {
  // 과목 키 → { id: 시도 번호(받기 전·실패면 null), at: 수업을 연 시각, n: 순번 }
  const byCourse = new Map();
  let serial = 0;
  const begin = (key, now) => {
    const n = ++serial;
    byCourse.set(key, { id: null, at: now, n });
    return n;
  };
  return {
    /** 새 시도를 시작한다(다시 듣기). 반환: 이 시도의 순번(번호를 받으면 fill에 넘긴다). */
    begin,
    /** 수업 화면을 열 때. 체험한 결과가 있고 보관한 시도가 있으면 이어 쓰고 null, 아니면 새 시도를 시작해 순번을 돌려준다. */
    open(key, { played, now }) {
      return played && byCourse.has(key) ? null : begin(key, now);
    },
    /** 서버가 준 시도 번호를 넣는다. 그사이 새 시도가 시작됐으면(순번이 다르면) 늦게 온 이전 응답이라 버린다. */
    fill(key, n, id) {
      const entry = byCourse.get(key);
      if (entry?.n === n) byCourse.set(key, { ...entry, id });
    },
    /** 이수에 쓸 시도를 꺼내고 지운다(한 시도는 한 번만 쓴다). 없으면 { id: null, at: 0 }. */
    take(key) {
      const entry = byCourse.get(key) ?? { id: null, at: 0, n: 0 };
      byCourse.delete(key);
      return entry;
    },
  };
}

export const lessonAttempts = createLessonAttempts();
