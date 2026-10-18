import test from "node:test";
import assert from "node:assert/strict";

import {
  parseResizeSettings,
  parseConvertSettings,
  parseCompressSettings,
  sanitizeBaseName,
} from "../src/validation/validators.js";

test("sanitizeBaseName sanitizes dirty filenames correctly", () => {
  assert.equal(sanitizeBaseName("photo..test.jpg", "fallback"), "photo_test");
  assert.equal(sanitizeBaseName("../../../etc/passwd.png", "fallback"), "passwd");
  assert.equal(sanitizeBaseName("   ", "fallback"), "fallback");
});

test("parseResizeSettings validates valid px and cm modes", () => {
  const pxSettings = parseResizeSettings({
    mode: "px",
    width: 800,
    height: 600,
    dpi: 72,
    format: "png",
  });
  assert.equal(pxSettings.mode, "px");
  assert.equal(pxSettings.width, 800);
  assert.equal(pxSettings.height, 600);
  assert.equal(pxSettings.format, "png");

  const cmSettings = parseResizeSettings({
    mode: "cm",
    width: 3.5,
    height: 4.5,
    dpi: 300,
    format: "jpg",
  });
  assert.equal(cmSettings.mode, "cm");
  assert.equal(cmSettings.width, 3.5);
  assert.equal(cmSettings.height, 4.5);
  assert.equal(cmSettings.dpi, 300);
});

test("parseConvertSettings validates supported sizes and formats", () => {
  const icoSettings = parseConvertSettings({
    sizes: [16, 32, 64],
    format: "ico",
  });
  assert.deepEqual(icoSettings.sizes, [16, 32, 64]);
  assert.equal(icoSettings.format, "ico");
});

test("parseCompressSettings validates target-kb bounds", () => {
  const valid = parseCompressSettings({
    targetKb: 500,
    format: "keep",
  });
  assert.equal(valid.targetKb, 500);
  assert.equal(valid.format, "keep");

  assert.throws(() => {
    parseCompressSettings({ targetKb: 5 }); // below min (10)
  });
  assert.throws(() => {
    parseCompressSettings({ targetKb: 50000 }); // above max (20000)
  });
});
