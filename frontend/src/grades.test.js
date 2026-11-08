import test from "node:test";
import assert from "node:assert/strict";
import { GRADES, averagePoint, better, cleanScore, gradeOf, passes } from "./grades.js";

test("정답률로 등급을 매기고, B- 이상이거나 P면 이수다", () => {
  const at = (percent) => gradeOf({ correct: percent, total: 100 }).grade;
  assert.deepEqual([100, 95, 94, 90, 85, 80, 75, 70, 69, 65, 60, 55, 50, 45, 40, 39, 0].map(at), [
    "A+", "A+", "A0", "A0", "A-", "B+", "B0", "B-", "C+", "C+", "C0", "C-", "D+", "D0", "D-", "F", "F",
  ]);
  assert.deepEqual(gradeOf({ correct: 11, total: 15 }), { grade: "B-", percent: 73 });
  assert.deepEqual(gradeOf("P"), { grade: "P", percent: null });
  assert.equal(gradeOf({ correct: 3, total: 2 }), null);
  assert.equal(gradeOf({ correct: 1, total: 0 }), null);
  assert.equal(gradeOf(null), null);
  assert.ok(passes("A+") && passes("B-") && passes("P"));
  assert.ok(!passes("C+") && !passes("F") && !passes("Z") && !passes(undefined));
  // 기준선은 위에서 아래로 내려가야 한다.
  GRADES.slice(1).forEach(([, min], i) => assert.ok(min < GRADES[i][1]));
});

test("재수강하면 더 좋은 성적을 남기고, 평균 평점은 P를 빼고 계산한다", () => {
  assert.equal(better("C+", "B0"), "B0");
  assert.equal(better("A0", "B0"), "A0");
  assert.equal(better("P", "C0"), "P");
  assert.equal(better("P", "A0"), "A0");
  assert.equal(better(undefined, "B0"), "B0");
  assert.equal(averagePoint(["A+", "B0", "P"]), 3.9);
  assert.equal(averagePoint(["P"]), null);
  assert.deepEqual(cleanScore({ correct: 2, total: 3, extra: 1 }), { correct: 2, total: 3 });
});
