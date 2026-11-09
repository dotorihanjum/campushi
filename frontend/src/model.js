import { cleanLessonGames } from "./lessonGames.js";
import { gameFor, isGame } from "./games.js";
import { groupExperience, GROUPS } from "./groups.js";
import { better, cleanScore, gradeOf, isGrade, passes, PASS } from "./grades.js";

// 학기 없이 학년 단위로 진행한다(2026-11-09 사용자 결정). 열린 학년의 과목은 아무 순서로나 듣고,
// 그 학년 필수과목(전공기초·전공필수) 중 체험이 있는 것을 모두 B- 이상으로 이수하면 다음 학년이 열린다.
// 이전 학기제 기록(campushi-v1)과 형식이 달라 새 키로 저장한다.
export const STORAGE_KEY = "campushi-v2";
export const OLD_STORAGE_KEYS = ["campushi-v1"];
export const YEARS = [1, 2, 3, 4];
export const REQUIRED_KINDS = ["전공기초", "전공필수"];
export const ELECTIVE = "전공선택";

// 졸업 과제. 틀 A(칠해서 완성하는 작품)는 artwork, 그 밖의 틀(G AI 가르치기 등)은 수업 안에서 끝까지 해보는 프로젝트다.
const asFinal = (data) => ({ kind: data.template === "A" ? "artwork" : "project", name: data.title, ...data });

// 과목을 이수하면(B- 이상 또는 P) 받는 크레딧. 재수강해서 이수해도 받는다(2026-11-09 사용자 결정, 임시값).
// 지급량·반복 제한·구매는 값이 정해지면 바꾼다. 모은 크레딧은 멘토링이 생기면 쓴다.
export const CREDIT_PER_PASS = 5;

export const initialState = {
  version: 2,
  // 입학한 학과: { 학과id: {} }.
  journeys: {},
  // 지금 보고 있는 학과와, 홈에 보여 주던(지금 체험 중인) 학과.
  current: null,
  studying: null,
  // 과목 성적: { "학과id|과목": { grade, percent, attempts } }. 재수강하면 가장 좋은 성적을 남긴다.
  records: {},
  // 수업 중 마지막으로 끝낸 체험: { "학과id|과목": { game, summary, score } }. 완료하면 지운다.
  plays: {},
  // 과목마다 남긴 한 줄 기록과 쓰던 기록.
  notes: {},
  drafts: {},
  // 서버에서 받은 학과 데이터. 저장해 두었다가 서버에 닿지 않아도 진행 중인 체험을 이어간다.
  catalog: [],
  // 모은 크레딧(모든 학과 공용).
  credits: 0,
  onboarded: false,
  // 캠퍼스에 도착하는 인트로를 봤는지.
  introSeen: false,
};

const text = (value, limit = 200) => (typeof value === "string" && value.trim() && value.length <= limit ? value : null);
const subjectList = (value) => (Array.isArray(value) ? [...new Set(value.filter((s) => text(s)))] : []);
export const courseKey = (id, subject) => `${id}|${subject}`;

/** 서버의 학과 데이터를 화면에서 쓰는 학과로 만든다. 형식이 틀리면 null. */
export function createDepartment(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = text(raw.id, 60);
  const school = text(raw.school, 60);
  const name = text(raw.name, 60);
  const group = GROUPS.some((item) => item.id === raw.group) ? raw.group : null;
  if (!id || !school || !name || !group || id.includes("|")) return null;
  const years = Object.fromEntries(YEARS.map((year) => [year, subjectList(raw.years?.[year])]));
  const finalSubject = text(raw.final) && years[4].includes(raw.final) ? raw.final : null;
  const groupFinal = groupExperience(group, "final");
  if (YEARS.some((year) => !years[year].length) || !finalSubject || !groupFinal) return null;
  const all = new Set(YEARS.flatMap((year) => years[year]));
  // 과목 → 이수구분. 편성표에 없는 과목은 버리고, 적히지 않은 과목은 전공선택이다.
  const kinds = {};
  for (const kind of REQUIRED_KINDS) for (const subject of subjectList(raw.kinds?.[kind])) if (all.has(subject) && !kinds[subject]) kinds[subject] = kind;
  const practice = groupExperience(group, "practice");
  const practiceSubject = practice && all.has(raw.practice) ? raw.practice : null;
  const url = text(raw.source?.url, 500);
  return {
    id,
    school,
    name,
    officialName: text(raw.official_name) || name,
    category: text(raw.category, 20) || "",
    // 학과가 있는 국제캠퍼스 건물(campus.js의 건물 이름).
    building: text(raw.building, 60) || "",
    studyGroup: group,
    duration: text(raw.duration, 20) || "4년",
    intro: text(raw.intro, 300) || "",
    tags: subjectList(raw.tags).slice(0, 3),
    source: {
      title: text(raw.source?.title) || "",
      url: url && /^https:\/\//.test(url) ? url : "",
      year: Number.isInteger(raw.source?.curriculum_year) ? raw.source.curriculum_year : null,
    },
    // 공식 편성표의 학년별 과목.
    years,
    kinds,
    lessonGames: cleanLessonGames(raw.games),
    practice,
    practiceSubject,
    final: asFinal(groupFinal),
    finalSubject,
  };
}

// 과목의 이수구분: 전공기초·전공필수·전공선택.
export const kindOf = (d, subject) => d.kinds[subject] || ELECTIVE;
export const isRequired = (d, subject) => !!d.kinds[subject];
// 과목이 편성된 학년(처음 나오는 학년). 편성표에 없으면 null.
export const yearOf = (d, subject) => YEARS.find((year) => d.years[year].includes(subject)) ?? null;
// 과목의 체험: 졸업 과제 과목이면 final, 실습 과목이면 학과군 실습(group:학과군), 연습 문제가 있으면 그 유형, 없으면 null(구현 예정).
export const gameOf = (d, subject) =>
  subject === d.finalSubject ? "final" : subject === d.practiceSubject ? `group:${d.studyGroup}` : gameFor(subject, d.lessonGames);
// 체험이 아직 없는(구현 예정) 과목인지.
export const isPlanned = (d, subject) => !gameOf(d, subject);

// 저장된 학과 데이터로 만든 학과 목록.
export const departmentsOf = (state) => (state.catalog || []).map(createDepartment).filter(Boolean);
const findDepartment = (state, id) => departmentsOf(state).find((d) => d.id === id) || null;
export const recordOf = (state, id, subject) => state.records?.[courseKey(id, subject)] || null;

/**
 * 학과의 진행 상황. 학년마다 과목 상태와 열렸는지, 다음 학년까지 남은 필수과목(체험이 있는 것만)을 계산한다.
 * 1학년은 늘 열려 있고, 앞 학년이 열려 있고 그 학년의 남은 필수과목이 없으면 다음 학년이 열린다.
 * 졸업: 4학년이 열렸고 4학년 남은 필수과목이 없으며 졸업 과제를 이수했을 때.
 */
export function progressOf(state, d) {
  const enrolled = !!state.journeys?.[d.id];
  const years = [];
  for (const year of YEARS) {
    const courses = d.years[year].map((subject) => {
      const record = recordOf(state, d.id, subject);
      return {
        subject,
        year,
        kind: kindOf(d, subject),
        required: isRequired(d, subject),
        planned: isPlanned(d, subject),
        final: subject === d.finalSubject,
        record,
        passed: !!record && passes(record.grade),
      };
    });
    const left = courses.filter((course) => course.required && !course.planned && !course.passed);
    const open = year === 1 || (years[year - 2].open && years[year - 2].left.length === 0);
    years.push({ year, open, courses, left });
  }
  const openYear = Math.max(...years.filter((item) => item.open).map((item) => item.year));
  const finalRecord = recordOf(state, d.id, d.finalSubject);
  const graduated = enrolled && years[3].open && years[3].left.length === 0 && !!finalRecord && passes(finalRecord.grade);
  const taken = years.flatMap((item) => item.courses).filter((course) => course.record);
  // 졸업까지 해야 할 것: 체험이 있는 필수과목과 졸업 과제. 그중 이수한 비율.
  const goals = years.flatMap((item) => item.courses).filter((course) => (course.required && !course.planned) || course.final);
  const done = goals.filter((course) => course.passed).length;
  return {
    enrolled,
    years,
    openYear,
    graduated,
    taken,
    passedCount: taken.filter((course) => course.passed).length,
    percent: goals.length ? Math.round((done / goals.length) * 100) : 0,
  };
}

/**
 * 수업을 마치고 성적을 받는다. 입학한 학과의 열린 학년 과목이고, 그 과목의 체험을 끝까지 해본 결과(plays)가 있어야 한다.
 * 재수강이면 더 좋은 성적을 남기고 들은 횟수를 늘린다. 적은 기록은 남기고, 쓰던 기록과 체험 결과는 지운다.
 */
export function completeCourse(state, id, subject, note = "") {
  const d = findDepartment(state, id);
  if (!d || !state.journeys?.[id]) return state;
  const year = yearOf(d, subject);
  const game = gameOf(d, subject);
  if (!year || !game || !progressOf(state, d).years[year - 1].open) return state;
  const key = courseKey(id, subject);
  const play = state.plays?.[key];
  const result = play?.game === game ? gradeOf(play.score) : null;
  if (!result) return state;
  const old = state.records?.[key];
  // 이번 성적이 더 좋거나(같은 등급이면 정답률이 더 높으면) 이번 것을 남긴다.
  const improved =
    !old || (better(old.grade, result.grade) === result.grade && (old.grade !== result.grade || (result.percent ?? -1) > (old.percent ?? -1)));
  const grade = improved ? result.grade : old.grade;
  const percent = improved ? result.percent : old.percent;
  const { [key]: finishedPlay, ...plays } = state.plays;
  const { [key]: finishedDraft, ...drafts } = state.drafts || {};
  return {
    ...state,
    plays,
    drafts,
    credits: (state.credits || 0) + (passes(result.grade) ? CREDIT_PER_PASS : 0),
    notes: note.trim() ? { ...state.notes, [key]: note.trim() } : state.notes,
    records: { ...state.records, [key]: { grade, percent, attempts: (old?.attempts || 0) + 1, last: result.grade } },
  };
}

/**
 * 다음 학년(4학년이면 졸업)까지의 진행: 지금 열린 마지막 학년의 필수과목(체험이 있는 것, 4학년은 졸업 과제 포함) 중 이수한 수.
 * target은 열릴 학년(4학년이면 null = 졸업).
 */
export function nextStepOf(progress) {
  const year = progress.openYear;
  const goals = progress.years[year - 1].courses.filter((course) => (course.required && !course.planned) || (year === 4 && course.final));
  const done = goals.filter((course) => course.passed).length;
  return {
    target: year < 4 ? year + 1 : null,
    done,
    total: goals.length,
    percent: progress.graduated || !goals.length ? 100 : Math.round((done / goals.length) * 100),
  };
}

// 수업 중 체험을 끝냈을 때 결과를 남긴다(완료 전까지는 마지막 결과만 둔다).
export function savePlay(state, id, subject, game, summary, score) {
  const clean = cleanScore(score);
  if (!clean || (!isGame(game) && game !== "final")) return state;
  return { ...state, plays: { ...state.plays, [courseKey(id, subject)]: { game, summary: String(summary || "").slice(0, 200), score: clean } } };
}
// 학과 상세의 학년별 과목: [{ year, open: [체험할 수 있는 과목], others: [체험 구현 예정인 과목] }].
export function yearSubjects(d) {
  return YEARS.map((year) => {
    const subjects = d.years[year];
    const open = subjects.filter((subject) => !isPlanned(d, subject));
    return { year, open, others: subjects.filter((subject) => !open.includes(subject)) };
  });
}

/* 저장 ----------------------------------------------------------------- */

/** 저장된 값(또는 새 학과 데이터를 넣은 상태)을 지금 형식에 맞게 정리한다. 맞지 않는 기록은 버린다. */
export function normalize(value) {
  if (!value || typeof value !== "object") return structuredClone(initialState);
  const catalog = Array.isArray(value.catalog) ? value.catalog.filter((raw) => createDepartment(raw)) : [];
  const built = new Map(catalog.map((raw) => [raw.id, createDepartment(raw)]));
  // "학과id|과목" 키가 지금 학과 데이터의 과목인지.
  const courseOf = (key) => {
    if (typeof key !== "string") return null;
    const at = key.indexOf("|");
    const d = at > 0 ? built.get(key.slice(0, at)) : null;
    const subject = d && key.slice(at + 1);
    return d && yearOf(d, subject) ? { d, subject } : null;
  };
  const pick = (source, keep) =>
    Object.fromEntries(Object.entries(source && typeof source === "object" ? source : {}).flatMap(([key, item]) => {
      const course = courseOf(key);
      const kept = course ? keep(item, course) : null;
      return kept ? [[key, kept]] : [];
    }));
  const journeys = Object.fromEntries(Object.keys(value.journeys || {}).filter((id) => built.has(id)).map((id) => [id, {}]));
  return {
    ...structuredClone(initialState),
    catalog,
    journeys,
    records: pick(value.records, (item, { d }) =>
      journeys[d.id] && isGrade(item?.grade)
        ? {
            grade: item.grade,
            percent: item.grade === PASS || !Number.isInteger(item.percent) ? null : Math.min(100, Math.max(0, item.percent)),
            attempts: Math.max(1, Math.floor(Number(item.attempts) || 1)),
            last: isGrade(item.last) ? item.last : item.grade,
          }
        : null,
    ),
    plays: pick(value.plays, (item, { d, subject }) =>
      item?.game === gameOf(d, subject) && cleanScore(item.score) ? { game: item.game, summary: String(item.summary || "").slice(0, 200), score: cleanScore(item.score) } : null,
    ),
    notes: pick(value.notes, (item) => (typeof item === "string" && item.trim() ? item.slice(0, 3000) : null)),
    drafts: pick(value.drafts, (item) => (typeof item === "string" ? item.slice(0, 3000) : null)),
    credits: Number.isInteger(value.credits) && value.credits > 0 ? value.credits : 0,
    introSeen: !!value.introSeen,
    current: built.has(value.current) ? value.current : null,
    studying: Object.hasOwn(journeys, value.studying) ? value.studying : null,
    onboarded: !!value.onboarded,
  };
}

// 저장된 기록을 읽는다. 이전 형식(학기제) 기록은 쓸 수 없어 지우되, 시작 화면을 지나왔는지는 이어 받는다.
export function loadState(storage) {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (saved) return normalize(JSON.parse(saved));
    let onboarded = false;
    for (const key of OLD_STORAGE_KEYS) {
      const old = storage.getItem(key);
      if (old) onboarded = onboarded || !!JSON.parse(old)?.onboarded;
      storage.removeItem(key);
    }
    return { ...structuredClone(initialState), onboarded };
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
