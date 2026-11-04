import test from "node:test";
import assert from "node:assert/strict";

import {
  parseResizeSettings,
  parseConvertSettings,
  parseCompressSettings,
  parseWatermarkSettings,
  parsePdfSettings,
  parseAudioSettings,
  parseOcrSettings,
  parseUrlDownloadSettings,
  detectImageFormat,
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

test("detectImageFormat detects HEIC files by magic bytes and extension", () => {
  // ISO BMFF box: 4 zero bytes, "ftyp", "heic"
  const heicMagic = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  assert.equal(detectImageFormat(heicMagic, "iphone_photo.bin"), "heic");
  assert.equal(detectImageFormat(Buffer.alloc(20), "IMG_0001.HEIC"), "heic");
  assert.equal(detectImageFormat(Buffer.alloc(20), "IMG_0002.heif"), "heic");
});

test("parseWatermarkSettings validates both text and logo image modes", () => {
  const textWatermark = parseWatermarkSettings({
    watermarkType: "text",
    text: "© Photography by PicTools",
    position: "bottom-right",
    opacity: 50,
    size: 10,
    color: "white",
    format: "png",
  });
  assert.equal(textWatermark.watermarkType, "text");
  assert.equal(textWatermark.text, "© Photography by PicTools");
  assert.equal(textWatermark.opacity, 50);

  const imageWatermark = parseWatermarkSettings(
    {
      watermarkType: "image",
      position: "center",
      opacity: 80,
      size: 25,
      format: "jpg",
    },
    true,
  );
  assert.equal(imageWatermark.watermarkType, "image");
  assert.equal(imageWatermark.position, "center");
  assert.equal(imageWatermark.size, 25);
});

test("parsePdfSettings validates compress and img2pdf operations", () => {
  const compress = parsePdfSettings({ op: "compress" });
  assert.equal(compress.op, "compress");

  const img2pdf = parsePdfSettings({ op: "img2pdf" });
  assert.equal(img2pdf.op, "img2pdf");

  const protect = parsePdfSettings({
    op: "protect",
    userPassword: "secret-password",
    ownerPassword: "admin-password",
    permissions: { print: true, copy: false },
  });
  assert.equal(protect.op, "protect");
  assert.equal(protect.userPassword, "secret-password");
  assert.equal(protect.ownerPassword, "admin-password");
  assert.equal(protect.permissions?.print, true);
  assert.equal(protect.permissions?.copy, false);

  const unlock = parsePdfSettings({
    op: "unlock",
    password: "secret-password",
  });
  assert.equal(unlock.op, "unlock");
  assert.equal(unlock.password, "secret-password");

  assert.throws(() => {
    parsePdfSettings({ op: "invalid_op" });
  });
});

test("parseAudioSettings validates formats, bitrates and options", () => {
  const mp3 = parseAudioSettings({
    format: "mp3",
    bitrate: 320,
    sampleRate: 44100,
    channels: "stereo",
    volume: 1.25,
    trimStart: 5,
    trimEnd: 30,
    voicePreset: "girl",
    pitchShift: 4.2,
    speed: 1.1,
    reverb: 0.35,
    copyStream: false,
  });
  assert.equal(mp3.format, "mp3");
  assert.equal(mp3.bitrate, 320);
  assert.equal(mp3.sampleRate, 44100);
  assert.equal(mp3.channels, "stereo");
  assert.equal(mp3.volume, 1.25);
  assert.equal(mp3.trimStart, 5);
  assert.equal(mp3.trimEnd, 30);
  assert.equal(mp3.voicePreset, "girl");
  assert.equal(mp3.pitchShift, 4.2);
  assert.equal(mp3.speed, 1.1);
  assert.equal(mp3.reverb, 0.35);
  assert.equal(mp3.copyStream, false);

  const defaults = parseAudioSettings({ format: "flac" });
  assert.equal(defaults.format, "flac");
  assert.equal(defaults.bitrate, 192);
  assert.equal(defaults.channels, "keep");
  assert.equal(defaults.copyStream, false);

  const copyExtract = parseAudioSettings({ format: "aac", copyStream: true });
  assert.equal(copyExtract.copyStream, true);

  const vocalStem = parseAudioSettings({ format: "wav", stemMode: "vocals" });
  assert.equal(vocalStem.stemMode, "vocals");

  const instrumentalStem = parseAudioSettings({ format: "mp3", stemMode: "instrumental" });
  assert.equal(instrumentalStem.stemMode, "instrumental");

  assert.throws(() => {
    parseAudioSettings({ format: "unsupported_codec" });
  });
});

test("parseOcrSettings validates formats and language options", () => {
  const ocr = parseOcrSettings({ format: "docx", language: "en-US" });
  assert.equal(ocr.format, "docx");
  assert.equal(ocr.language, "en-US");

  const jsonOcr = parseOcrSettings({ format: "json" });
  assert.equal(jsonOcr.format, "json");
  assert.equal(jsonOcr.language, undefined);

  const fallback = parseOcrSettings({});
  assert.equal(fallback.format, "txt");
});

test("parseUrlDownloadSettings validates streaming qualities, URLs and formats", () => {
  const result1080 = parseUrlDownloadSettings({
    url: "https://www.youtube.com/watch?v=PYlkM3jKCHk",
    quality: "1080",
    format: "mp4",
    title: "Zoya Afghan | Dab Dab Rozi Shab",
    kind: "stream",
    threads: 8,
  });
  assert.equal(result1080.url, "https://www.youtube.com/watch?v=PYlkM3jKCHk");
  assert.equal(result1080.quality, "1080");
  assert.equal(result1080.format, "mp4");
  assert.equal(result1080.title, "Zoya Afghan | Dab Dab Rozi Shab");
  assert.equal(result1080.kind, "stream");
  assert.equal(result1080.threads, 8);

  const result360 = parseUrlDownloadSettings({
    url: "https://www.youtube.com/watch?v=PYlkM3jKCHk",
    quality: "360",
    format: "mp3",
  });
  assert.equal(result360.quality, "360");
  assert.equal(result360.format, "mp3");
  assert.equal(result360.title, undefined);

  const resultPreset = parseUrlDownloadSettings({
    url: "https://example.com/stream.m3u8",
    quality: "preset:720",
    format: "mp4",
    kind: "hls",
  });
  assert.equal(resultPreset.quality, "preset:720");
  assert.equal(resultPreset.kind, "hls");

  const invalidQuality = parseUrlDownloadSettings({
    url: "https://example.com/video.mp4",
    quality: "malicious--quality$%",
  });
  assert.equal(invalidQuality.quality, "source");

  assert.throws(() => {
    parseUrlDownloadSettings({ url: "javascript:alert(1)" });
  });

  assert.throws(() => {
    parseUrlDownloadSettings({ url: "not-a-url" });
  });

  assert.throws(() => {
    parseUrlDownloadSettings({ url: "https://example.com/video.mp4", format: "exe" });
  });
});


