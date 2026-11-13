import test from "node:test";
import assert from "node:assert/strict";
import { cleanProfilePhoto, prepareProfilePhoto, PHOTO_DATA_MAX, PHOTO_FILE_MAX } from "./profilePhoto.js";

test("프로필 사진은 크기가 제한된 JPEG 데이터만 복원한다", () => {
  const photo = "data:image/jpeg;base64,/9j/AA==";
  assert.equal(cleanProfilePhoto(photo), photo);
  for (const value of [null, undefined, {}, 42, "https://example.com/photo.jpg", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/jpeg;base64,", `data:image/jpeg;base64,${"A".repeat(PHOTO_DATA_MAX)}`])
    assert.equal(cleanProfilePhoto(value), null);
});

test("지원하지 않는 형식과 큰 사진은 읽기 전에 안내한다", async () => {
  await assert.rejects(prepareProfilePhoto({ type: "image/svg+xml", size: 100 }), /JPG, PNG, WebP/);
  await assert.rejects(prepareProfilePhoto({ type: "image/jpeg", size: PHOTO_FILE_MAX + 1 }), /10MB/);
});
