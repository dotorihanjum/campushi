import { cleanLessonGames } from "./lessonGames.js";
import { gameFor, isGame } from "./games.js";
import { groupExperience, GROUPS } from "./groups.js";

export const STORAGE_KEY = "campushi-v1";
// 4년 8학기. 학기마다 그 학년의 과목 중 하나를 골라 체험하고, 4학년 2학기는 졸업 과제다.
export const YEARS = [1, 2, 3, 4];
const SLOTS = YEARS.flatMap((year) => [1, 2].map((semester) => ({ year, semester })));

// 졸업 과제. 틀 A(칠해서 완성하는 작품)는 artwork, 그 밖의 틀(G AI 가르치기 등)은 수업 안에서 끝까지 해보는 프로젝트다.
const asFinal = (data) => ({ kind: data.template === "A" ? "artwork" : "project", name: data.title, ...data });
export const finalOf = (department) => department?.final || null;
// 졸업 과제를 끝까지 해봤는지(artworks에 학과마다 기록한다).
export const finalReady = (state, department) => !!state.artworks?.[department.id];

export const initialState = {
  version: 1,
  // 학과 추천 질문의 답: { 질문 번호: 고른 보기 }.
  answers: {},
  journeys: {},
  // 지금 보고 있는 학과와, 홈에 보여 주던(지금 체험 중인) 학과.
  current: null,
  studying: null,
  notes: {},
  drafts: {},
  plays: {},
  artworks: {},
  // 학기 자리마다 고른 과목: { "학과id-자리번호": 과목 }.
  choices: {},
  // 서버에서 받은 학과 데이터. 저장해 두었다가 서버에 닿지 않아도 진행 중인 체험을 이어간다.
  catalog: [],
  onboarded: false,
};

const text = (value, limit = 200) => (typeof value === "string" && value.trim() && value.length <= limit ? value : null);
const subjectList = (value) => (Array.isArray(value) ? [...new Set(value.filter((s) => text(s)))] : []);

/**
 * 서버의 학과 데이터를 화면에서 쓰는 학과로 만든다. 형식이 틀리면 null.
 * 학기 자리 8개: 1-1 ~ 4-1은 그 학년의 고를 과목(choices) 중 하나를 고르고, 4-2는 졸업 과제(final)다.
 */
export function createDepartment(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = text(raw.id, 60);
  const school = text(raw.school, 60);
  const name = text(raw.name, 60);
  const group = GROUPS.some((item) => item.id === raw.group) ? raw.group : null;
  if (!id || !school || !name || !group) return null;
  const years = Object.fromEntries(YEARS.map((year) => [year, subjectList(raw.years?.[year])]));
  const choices = Object.fromEntries(YEARS.map((year) => [year, subjectList(raw.choices?.[year]).filter((s) => years[year].includes(s))]));
  const finalSubject = text(raw.final) && years[4].includes(raw.final) ? raw.final : null;
  const groupFinal = groupExperience(group, "final");
  // 1·2학기에 하나씩 고르므로 학년마다 두 과목 이상 있어야 하고, 졸업 과제가 있어야 한다.
  if (YEARS.some((year) => choices[year].length < 2) || !finalSubject || !groupFinal) return null;
  const practice = groupExperience(group, "practice");
  const practiceSubject = practice && YEARS.some((year) => choices[year].includes(raw.practice)) ? raw.practice : null;
  const final = asFinal(groupFinal);
  const url = text(raw.source?.url, 500);
  return {
    id,
    school,
    name,
    officialName: text(raw.official_name) || name,
    category: text(raw.category, 20) || "",
    studyGroup: group,
    duration: text(raw.duration, 20) || "4년",
    intro: text(raw.intro, 300) || "",
    tags: subjectList(raw.tags).slice(0, 3),
    // 제휴 학교 표시. 예시 제휴도 실제 제휴와 똑같이 동작하고, 예시라는 것은 안내 문구로 알린다.
    partner: raw.partner === true,
    partnerExample: raw.partner === true && raw.partner_example === true,
    source: {
      title: text(raw.source?.title) || "",
      url: url && /^https:\/\//.test(url) ? url : "",
      year: Number.isInteger(raw.source?.curriculum_year) ? raw.source.curriculum_year : null,
    },
    // 공식 편성표의 학년별 과목과, 그중 체험으로 고를 수 있는 과목.
    years,
    choices,
    lessonGames: cleanLessonGames(raw.games),
    practice,
    practiceSubject,
    final,
    finalSubject,
    yearNumbers: SLOTS.map((slot) => slot.year),
    semesters: SLOTS.map((slot) => slot.semester),
    // 학기 자리마다 고를 수 있는 과목. 졸업 과제 자리는 null.
    options: SLOTS.map((slot, i) => (i === SLOTS.length - 1 ? null : choices[slot.year])),
    lessons: SLOTS.map((_, i) => (i === SLOTS.length - 1 ? finalSubject : CHOOSE_TITLE)),
    games: SLOTS.map(() => null),
  };
}

// 체험 자리의 이름: "2학년 1학기".
export const stageLabel = (d, index) => `${d.yearNumbers[index]}학년 ${d.semesters[index]}학기`;
// 좁은 자리에 쓰는 짧은 이름: "2-1".
export const shortStage = (d, index) => `${d.yearNumbers[index]}-${d.semesters[index]}`;
// 학기 자리에서 고르기 전에 보여주는 이름.
export const CHOOSE_TITLE = "과목 고르기";
// 과목의 체험: 실습 과목이면 학과군 실습(group:학과군), 연습 문제가 있으면 그 유형, 없으면 null(기본 체험).
export const gameOf = (d, subject) =>
  subject === d.practiceSubject ? `group:${d.studyGroup}` : gameFor(subject, d.lessonGames);

// 고른 과목을 반영한 학과: 학기 자리의 수업 이름과 체험을 고른 과목으로 바꾼다. chosen[i]는 그 자리에서 골랐는지.
export function withChoices(d, choices = {}) {
  if (!d?.options) return d;
  const picked = d.options.map((options, i) => (options ? choices[`${d.id}-${i}`] || null : null));
  return {
    ...d,
    chosen: picked.map((subject, i) => (d.options[i] ? !!subject : null)),
    lessons: d.lessons.map((lesson, i) => picked[i] || lesson),
    games: d.games.map((game, i) => (picked[i] ? gameOf(d, picked[i]) : game)),
  };
}

// 저장된 학과 데이터로 만든 학과 목록(고른 과목 반영).
export const departmentsOf = (state) =>
  (state.catalog || []).map(createDepartment).filter(Boolean).map((d) => withChoices(d, state.choices));
const findDepartment = (state, id) => (state.catalog || []).map(createDepartment).find((d) => d?.id === id) || null;

// 지금 하는 학기 자리의 과목을 고른다. 그 자리의 과목이 아니거나 다른 학기에 이미 고른 과목이면 그대로 둔다.
// 과목을 바꾸면 그 자리에서 해 둔 체험과 쓰던 기록은 지운다(다른 과목의 것이므로).
export function chooseSubject(state, id, index, subject) {
  const department = findDepartment(state, id);
  const journey = state.journeys[id];
  const key = `${id}-${index}`;
  const choices = state.choices || {};
  if (!department?.options?.[index]?.includes(subject) || !journey || journey.paused || journey.completed !== index) return state;
  if (department.options.some((options, i) => options && i !== index && choices[`${id}-${i}`] === subject)) return state;
  if (choices[key] === subject) return state;
  const { [key]: oldPlay, ...plays } = state.plays || {};
  const { [key]: oldDraft, ...drafts } = state.drafts || {};
  return { ...state, plays, drafts, choices: { ...choices, [key]: subject } };
}

// 휴강해서 미이수로 남긴 자리인지.
export const isSkipped = (journey, index) => Array.isArray(journey?.skipped) && journey.skipped.includes(index);

export function completeLesson(state, id, index, note) {
  const journey = state.journeys[id];
  const department = findDepartment(state, id);
  const total = department?.lessons.length || 0;
  // 마지막 자리는 졸업 과제를 끝까지 해봐야 완료된다.
  if (department && index === total - 1 && !finalReady(state, department)) return state;
  // 학기 자리는 과목을 골라야 완료할 수 있다.
  if (department?.options?.[index] && !state.choices?.[`${id}-${index}`]) return state;
  // 체험(연습 문제·실습)이 있는 수업은 해본 뒤에만 완료할 수 있다.
  const game = department ? withChoices(department, state.choices).games[index] : undefined;
  if (game && state.plays?.[`${id}-${index}`]?.game !== game) return state;
  // 지금 차례인 자리이거나, 휴강해서 미이수로 남긴 자리(다시 듣기)만 완료할 수 있다.
  const retake = isSkipped(journey, index);
  if (!journey || journey.paused || (journey.completed !== index && !retake) || index >= total) return state;
  // 느낀 점은 적지 않아도 완료할 수 있다(건너뛰기). 적었으면 기록으로 남긴다.
  const { [`${id}-${index}`]: finished, ...drafts } = state.drafts || {};
  return {
    ...state,
    drafts,
    notes: note.trim() ? { ...state.notes, [`${id}-${index}`]: note.trim() } : state.notes,
    journeys: {
      ...state.journeys,
      [id]: retake ? { ...journey, skipped: journey.skipped.filter((n) => n !== index) } : { ...journey, completed: index + 1 },
    },
  };
}

// 지금 차례인 수업을 휴강한다: 미이수로 기록하고 다음 자리로 넘어간다. 마지막 자리(졸업 과제)도 휴강하면 졸업한다.
// 쓰던 기록과 해 둔 체험은 지우지 않는다(다시 들을 때 이어서 한다). 학기 자리는 과목을 고른 뒤에만 휴강할 수 있다.
export function skipLesson(state, id, index) {
  const journey = state.journeys[id];
  const department = findDepartment(state, id);
  const total = department?.lessons.length || 0;
  if (!journey || journey.paused || journey.completed !== index || index >= total) return state;
  if (department.options?.[index] && !state.choices?.[`${id}-${index}`]) return state;
  const skipped = [...new Set([...(journey.skipped || []), index])].sort((a, b) => a - b);
  return { ...state, journeys: { ...state.journeys, [id]: { ...journey, completed: index + 1, skipped } } };
}

// 진행 상황: 지나온 자리(completed) 중 미이수(skipped)를 뺀 것이 이수(passed)다.
export function progressOf(journey, total) {
  const completed = Math.min(Math.max(0, journey?.completed || 0), total);
  const skipped = (journey?.skipped || []).filter((n) => n < completed);
  return { completed, skipped, passed: completed - skipped.length, finished: !!journey && completed === total };
}

// 학과 상세의 학년별 과목: [{ year, open: [고를 수 있는 과목], others: [그 밖의 편성 과목] }].
export function yearSubjects(d) {
  return YEARS.map((year) => ({
    year,
    open: year === 4 ? [...d.choices[4], d.finalSubject] : d.choices[year],
    others: d.years[year].filter((subject) => !d.choices[year].includes(subject) && subject !== d.finalSubject),
  }));
}

// 제휴 학교 표시. 예시 제휴도 실제 제휴와 같은 배지를 쓰고, 예시라는 것은 화면의 안내 문구로 알린다.
export const PARTNER_LABEL = "제휴 학교";
export const PARTNER_EXAMPLE_NOTE = "* 제휴 학교 표시는 서비스 예시입니다";
export const showsExampleNote = (items) => items.some((item) => item?.partner === true && item.partnerExample === true);

/* 학과 추천 ------------------------------------------------------------ */

// 질문마다 보기 하나를 고른다. 보기마다 더 가까운 학과(id)를 하나씩 연결해 둔다.
const question = (title, sub, options) => ({ title, sub, options: options.map(([label, id]) => ({ label, id })) });
export const QUESTIONS = [
  question("쉬는 시간엔 주로 무엇을 하나요?", "가장 자주 하는 일을 골라요", [
    ["게임이나 앱을 이리저리 만져 보기", "khu-cse"],
    ["노트에 낙서하거나 그림 그리기", "khu-id"],
    ["퍼즐이나 수수께끼 풀기", "khu-cse"],
    ["물건이 어떻게 생겼는지 살펴보기", "khu-id"],
  ]),
  question("어떤 순간에 시간 가는 줄 모르나요?", "좋아하거나 자신 있는 활동을 골라요", [
    ["규칙을 찾아 문제를 풀 때", "khu-cse"],
    ["손으로 무언가 만들 때", "khu-id"],
    ["귀찮은 일을 자동으로 하게 만들 때", "khu-cse"],
    ["예쁜 물건과 공간을 구경할 때", "khu-id"],
  ]),
  question("어떤 과목이 가장 재미있나요?", "성적과 상관없이 즐거운 과목을 골라요", [
    ["수학", "khu-cse"],
    ["정보", "khu-cse"],
    ["미술", "khu-id"],
    ["기술 · 가정", "khu-id"],
  ]),
  question("앞으로 만들어 보고 싶은 것은?", "막연해도 괜찮아요, 끌리는 대로 골라요", [
    ["많은 사람이 쓰는 앱이나 게임", "khu-cse"],
    ["스스로 배우는 AI", "khu-cse"],
    ["매일 손에 쥐는 물건", "khu-id"],
    ["사람이 머무는 공간이나 탈것", "khu-id"],
  ]),
];

// 모든 질문에 답했는지.
export const answeredAll = (answers = {}) => QUESTIONS.every((q, i) => q.options.some((o) => o.label === answers[i + 1]));

/**
 * 답으로 학과를 추천한다: 보기가 가리키는 학과를 세어 많은 순서. 같으면 목록 순서를 따르고 tie로 알린다.
 * 모든 질문에 답하지 않았거나 학과가 없으면 null.
 */
export function recommend(answers, departments) {
  if (!answeredAll(answers) || !departments.length) return null;
  const counts = Object.fromEntries(departments.map((d) => [d.id, 0]));
  QUESTIONS.forEach((q, i) => {
    const id = q.options.find((o) => o.label === answers[i + 1]).id;
    if (Object.hasOwn(counts, id)) counts[id] += 1;
  });
  const ranked = [...departments].sort((a, b) => counts[b.id] - counts[a.id]);
  return { best: ranked[0], others: ranked.slice(1), count: counts[ranked[0].id], total: QUESTIONS.length, tie: ranked.length > 1 && counts[ranked[0].id] === counts[ranked[1].id] };
}

/* 저장 ----------------------------------------------------------------- */

/** 저장된 값(또는 새 학과 데이터를 넣은 상태)을 지금 형식에 맞게 정리한다. 맞지 않는 기록은 버린다. */
export function normalize(value) {
  if (!value || typeof value !== "object") return structuredClone(initialState);
  const catalog = Array.isArray(value.catalog) ? value.catalog.filter((raw) => createDepartment(raw)) : [];
  const built = new Map(catalog.map((raw) => [raw.id, createDepartment(raw)]));
  const total = (id) => built.get(id).lessons.length;
  const slotKey = (key) => {
    const match = typeof key === "string" && key.match(/^(.*)-(\d+)$/);
    return match && built.has(match[1]) && Number(match[2]) < total(match[1]) ? { id: match[1], index: Number(match[2]) } : null;
  };
  const journeys = Object.fromEntries(
    Object.entries(value.journeys || {})
      .filter(([id]) => built.has(id))
      .map(([id, item]) => {
        const completed = Math.min(total(id), Math.max(0, Math.floor(Number(item?.completed) || 0)));
        const skipped = Array.isArray(item?.skipped)
          ? [...new Set(item.skipped.filter((n) => Number.isInteger(n) && n >= 0 && n < completed))].sort((a, b) => a - b)
          : [];
        return [id, { completed, paused: !!item?.paused, ...(skipped.length ? { skipped } : {}) }];
      }),
  );
  const texts = (source, limit) =>
    Object.fromEntries(
      Object.entries(source && typeof source === "object" ? source : {})
        .filter(([key, note]) => slotKey(key) && typeof note === "string")
        .map(([key, note]) => [key, note.slice(0, limit)]),
    );
  // 학기 자리마다 고른 과목. 그 자리의 과목이고 다른 자리와 겹치지 않는 것만 둔다.
  const choices = {};
  for (const [key, subject] of Object.entries(value.choices && typeof value.choices === "object" ? value.choices : {})) {
    const slot = slotKey(key);
    if (!slot || typeof subject !== "string" || !built.get(slot.id).options[slot.index]?.includes(subject)) continue;
    if (Object.entries(choices).some(([other, picked]) => other.startsWith(`${slot.id}-`) && picked === subject)) continue;
    choices[key] = subject;
  }
  const plays = {};
  for (const [key, play] of Object.entries(value.plays && typeof value.plays === "object" ? value.plays : {}))
    if (slotKey(key) && isGame(play?.game) && typeof play.summary === "string") plays[key] = { game: play.game, summary: play.summary.slice(0, 200) };
  return {
    ...structuredClone(initialState),
    catalog,
    journeys,
    choices,
    plays,
    notes: texts(value.notes, 3000),
    drafts: texts(value.drafts, 3000),
    artworks: Object.fromEntries(Object.keys(value.artworks || {}).filter((id) => built.has(id) && value.artworks[id] === true).map((id) => [id, true])),
    answers: Object.fromEntries(
      QUESTIONS.map((q, i) => [i + 1, value.answers?.[i + 1]]).filter(([n, label]) => QUESTIONS[n - 1].options.some((o) => o.label === label)),
    ),
    current: built.has(value.current) ? value.current : null,
    studying: Object.hasOwn(journeys, value.studying) ? value.studying : null,
    onboarded: !!value.onboarded,
  };
}

export function loadState(storage) {
  try {
    return normalize(JSON.parse(storage.getItem(STORAGE_KEY)));
  } catch {
    return structuredClone(initialState);
  }
}

// 서버에서 새로 받은 학과 데이터로 바꾼다. 형식이 맞지 않는 학과는 빼고, 바뀐 편성에 맞지 않는 기록은 정리한다.
// 받은 데이터에 쓸 수 있는 학과가 하나도 없으면 저장해 둔 데이터를 그대로 쓴다.
export function refreshCatalog(state, raws) {
  if (!Array.isArray(raws) || !raws.some((raw) => createDepartment(raw))) return state;
  return normalize({ ...state, catalog: raws });
}
