// 날짜 경계를 한국 시간으로 시험한다(node --test는 파일마다 따로 실행하므로 다른 테스트에 영향이 없다).
process.env.TZ = "Asia/Seoul";

import test from "node:test";
import assert from "node:assert/strict";
import { reportFileName } from "./reportFileName.js";

test("체험 리포트 파일 이름은 캠퍼스하이_학교_학과_YYYY-MM-DD.txt다", () => {
  assert.equal(reportFileName("경희대학교", "컴퓨터공학과", new Date("2026-11-18T14:30:00+09:00")), "캠퍼스하이_경희대학교_컴퓨터공학과_2026-11-18.txt");
  assert.equal(reportFileName("경희대학교", "산업디자인학과", new Date("2026-03-05T12:00:00+09:00")), "캠퍼스하이_경희대학교_산업디자인학과_2026-03-05.txt");
});

test("날짜는 UTC가 아니라 기기 로컬(한국 시간) 날짜다", () => {
  // 한국 시간 자정 직후(UTC로는 전날 15시)
  assert.equal(reportFileName("경희대학교", "컴퓨터공학과", new Date("2026-11-18T00:00:30+09:00")), "캠퍼스하이_경희대학교_컴퓨터공학과_2026-11-18.txt");
  // 한국 시간 오전 9시 직전(UTC로는 전날 23:59)과 9시
  assert.equal(reportFileName("경희대학교", "컴퓨터공학과", new Date("2026-11-18T08:59:59+09:00")), "캠퍼스하이_경희대학교_컴퓨터공학과_2026-11-18.txt");
  assert.equal(reportFileName("경희대학교", "컴퓨터공학과", new Date("2026-11-18T09:00:00+09:00")), "캠퍼스하이_경희대학교_컴퓨터공학과_2026-11-18.txt");
  // 한국 시간 자정 직전은 아직 그날이다
  assert.equal(reportFileName("경희대학교", "컴퓨터공학과", new Date("2026-11-18T23:59:59+09:00")), "캠퍼스하이_경희대학교_컴퓨터공학과_2026-11-18.txt");
  // 해가 바뀌는 날
  assert.equal(reportFileName("경희대학교", "컴퓨터공학과", new Date("2027-01-01T00:10:00+09:00")), "캠퍼스하이_경희대학교_컴퓨터공학과_2027-01-01.txt");
});

test("파일 이름으로 못 쓰는 문자와 공백은 -로 바꾼다", () => {
  const at = new Date("2026-11-18T10:00:00+09:00");
  assert.equal(reportFileName("경희대학교 국제캠퍼스", "웹/파이선 학과", at), "캠퍼스하이_경희대학교-국제캠퍼스_웹-파이선-학과_2026-11-18.txt");
  assert.equal(reportFileName('a\\b:c*d?e"f<g>h|i', "  학과 \t\n ", at), "캠퍼스하이_a-b-c-d-e-f-g-h-i_학과_2026-11-18.txt");
  // 연속된 못 쓰는 문자는 하나로, 앞뒤의 -와 .은 지운다(Windows는 끝의 .을 지운다).
  assert.equal(reportFileName("..//학교//..", "학과?", at), "캠퍼스하이_학교_학과_2026-11-18.txt");
  // 이름이 비면 그 칸을 빼고 빈 칸(__)을 남기지 않는다.
  assert.equal(reportFileName("///", "", at), "캠퍼스하이_2026-11-18.txt");
});
