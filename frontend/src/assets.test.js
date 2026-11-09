import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// assets.js는 이미지 파일을 import하므로 node에서 바로 불러올 수 없어 소스를 읽어 확인한다.
test("학년별 캐릭터는 1~4학년 네 장의 피그마 벡터(SVG)이고, 배경 없이 그림만 있다", () => {
  const source = readFileSync(new URL("./assets.js", import.meta.url), "utf8");
  const list = source.slice(source.indexOf("YEAR_CHARACTERS = ["), source.indexOf("];", source.indexOf("YEAR_CHARACTERS = [")));
  assert.deepEqual([...list.matchAll(/src: (\w+)/g)].map((m) => m[1]), ["characterGrade1", "characterGrade2", "characterGrade3", "characterGrade4"]);
  for (const n of [1, 2, 3, 4]) {
    const svg = readFileSync(new URL(`./assets/character-grade${n}.svg`, import.meta.url), "utf8");
    assert.ok(svg.startsWith("<svg"));
    // 피그마 내보내기의 배경(검은 캔버스, 슬라이드 바탕)과 스크립트·외부 참조가 없다.
    for (const bad of ['fill="#1E1E1E"', 'fill="#FCFBFE"', "<script", "<image", "href="]) assert.ok(!svg.includes(bad), `${n}: ${bad}`);
  }
});
