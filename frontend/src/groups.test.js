import test from "node:test";
import assert from "node:assert/strict";
import { GROUPS, buildGroupExperience, groupExperience, groupName } from "./groups.js";
import { groupData } from "./groupData.js";
import { cleanExperience } from "./experiences.js";

test("두 학과군에 검토를 통과한 실습과 졸업 과제가 있다", () => {
  assert.deepEqual(GROUPS.map((group) => group.id), ["computing", "design"]);
  assert.equal(groupName("computing"), "컴퓨터·AI");
  assert.equal(groupName("없음"), "");
  for (const group of GROUPS) {
    const practice = groupExperience(group.id, "practice");
    const final = groupExperience(group.id, "final");
    assert.ok(practice, `${group.id} 실습`);
    assert.ok(final, `${group.id} 졸업 과제`);
    // 실습은 수업 안에 들어가는 틀(순서 맞추기 B), 졸업 과제는 AI 가르치기(G, 컴퓨터·AI) 또는 작품(A, 디자인)이다.
    assert.equal(practice.template, "B");
    assert.ok(practice.learn, `${group.id} 알아두기`);
    assert.equal(final.template, { design: "A", computing: "G" }[group.id]);
  }
});

test("검토 대기이거나 형식이 틀린 학과군 데이터는 쓰지 않는다", () => {
  const original = groupData.design.practice;
  assert.ok(cleanExperience(buildGroupExperience({ ...original, status: "review" })));
  assert.equal(groupExperience("없는학과군", "practice"), null);
  groupData.design.practice = { ...original, status: "review" };
  assert.equal(groupExperience("design", "practice"), null);
  groupData.design.practice = { ...original, items: [] };
  assert.equal(groupExperience("design", "practice"), null);
  groupData.design.practice = original;
  assert.ok(groupExperience("design", "practice"));
});
