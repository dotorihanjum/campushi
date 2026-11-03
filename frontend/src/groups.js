// 학과군별 체험(실습 과목의 체험, 졸업 과제). 데이터는 groupData.js에 있다.
import { cleanExperience, experiences } from "./experiences.js";
import { groupData } from "./groupData.js";

export const GROUPS = [
  { id: "computing", name: "컴퓨터·AI" },
  { id: "design", name: "디자인·미술" },
];

export const groupName = (id) => GROUPS.find((group) => group.id === id)?.name || "";

// 학과군 데이터를 완성된 체험 데이터로 만든다. base가 있으면 experiences.js의 체험을 바탕으로 쓰고,
// options(계획서 칸별 보기)와 그 밖의 필드를 덮어쓴다.
export function buildGroupExperience(entry) {
  const { status, base, options, ...rest } = entry;
  const from = base ? experiences[base] : {};
  const data = { ...from, ...rest };
  if (options) data.prompts = (from.prompts || []).map((prompt, i) => ({ ...prompt, options: options[i] }));
  return data;
}

// 학과군의 체험(kind: "practice" | "final"). 별도 검토를 통과한(verified) 것만 쓰고, 없거나 형식이 틀리면 null이다.
export function groupExperience(id, kind) {
  const entry = groupData[id]?.[kind];
  if (!entry || entry.status !== "verified") return null;
  return cleanExperience(buildGroupExperience(entry));
}
