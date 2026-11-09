import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// assets.js는 이미지 파일을 import하므로 node에서 바로 불러올 수 없어 소스를 읽어 확인한다.
test("학년별 캐릭터는 1~4학년 네 장이고, 3학년은 노션 디자인 시스템의 그림을 쓴다", () => {
  const source = readFileSync(new URL("./assets.js", import.meta.url), "utf8");
  const list = source.slice(source.indexOf("YEAR_CHARACTERS = ["), source.indexOf("];", source.indexOf("YEAR_CHARACTERS = [")));
  assert.deepEqual([...list.matchAll(/src: (\w+)/g)].map((m) => m[1]), ["mascotWelcome", "mascotHome", "mascotGrade3", "mascotGrad"]);
  assert.ok(source.includes('import mascotGrade3 from "./assets/mascot-grade3.png";'));
  readFileSync(new URL("./assets/mascot-grade3.png", import.meta.url));
});
