import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

// Compile only the pure provider boundary; no database, Next server, or paid calls.
const output = path.resolve("test-runs/openai-render-contract");
mkdirSync(output, { recursive: true });
for (const name of ["render-contract", "image-normalize", "openai"]) {
  const source = readFileSync(`lib/ai/${name}.ts`, "utf8")
    .replace('"./render-contract"', '"./render-contract.cjs"')
    .replace('"./image-normalize"', '"./image-normalize.cjs"');
  writeFileSync(path.join(output, `${name}.cjs`), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText);
}
const require = createRequire(import.meta.url);
const api = require(path.join(output, "openai.cjs"));
const { ARCHITECTURE_LOCK, renderModeSchema } = require(path.join(output, "render-contract.cjs"));
const { normalizeSourceImageBytes } = require(path.join(output, "image-normalize.cjs"));

// A phone HDR capture: JFIF, an APP2 MPF index, a primary scan, then a second
// appended image. Shaped exactly like the owner's failing IMG-1221.jpeg.
function segment(marker, payload) {
  return Buffer.concat([Buffer.from([0xff, marker]), Buffer.from([(payload.length + 2) >> 8, (payload.length + 2) & 0xff]), payload]);
}
const primaryScan = Buffer.concat([segment(0xda, Buffer.from([0x01, 0x01, 0x00])), Buffer.from([0x12, 0xff, 0x00, 0x34]), Buffer.from([0xff, 0xd9])]);
const appendedGainMap = Buffer.concat([Buffer.from([0xff, 0xd8]), segment(0xe0, Buffer.from("JFIF\0", "latin1")), Buffer.from([0xff, 0xd9])]);
const mpfSegment = segment(0xe2, Buffer.from("MPF\0index", "latin1"));
const multiPictureJpeg = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  segment(0xe0, Buffer.from("JFIF\0", "latin1")),
  segment(0xe1, Buffer.from("Exif\0\0orientation", "latin1")),
  mpfSegment,
  segment(0xe2, Buffer.from("ICC_PROFILE\0colour", "latin1")),
  primaryScan,
  appendedGainMap
]);
const originalFetch = globalThis.fetch;
const envNames = ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_IMAGE_MODEL", "OPENAI_CONCEPT_IMAGE_MODEL", "OPENAI_IMAGE_QUALITY"];
const originalEnv = Object.fromEntries(envNames.map((key) => [key, process.env[key]]));
let checks = 0;
async function test(name, run) { await run(); console.log(`PASS ${name}`); checks++; }
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6wAAAAABJRU5ErkJggg==", "base64");
const imageResult = () => Response.json({ data: [{ b64_json: png.toString("base64") }], usage: { total_tokens: 1 } });
try {
  for (const key of envNames) delete process.env[key];
  process.env.OPENAI_API_KEY = "contract-test-key";
  await test("Sol structured output uses the schema and original photo", async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(options.body);
      assert.equal(body.model, "gpt-5.6-sol");
      assert.equal(body.text.format.strict, true);
      assert.equal(body.reasoning.effort, "low");
      assert.equal(body.input[0].content[1].image_url, "https://test.local/original.png");
      assert.equal(body.store, false);
      return Response.json({ output: [{ content: [{ type: "output_text", text: '{"ok":true}' }] }] });
    };
    const result = await api.runOpenAiStructuredResponse({ schemaName: "test", schema: { type: "object" }, instructions: "test", text: "test", images: [{ url: "https://test.local/original.png" }] });
    assert.deepEqual(JSON.parse(result.outputText), { ok: true });
  });
  await test("Designer edit pins Sunburst independently of the reasoning override", async () => {
    process.env.OPENAI_MODEL = "old-reasoning-model";
    globalThis.fetch = async (url, options) => {
      if (url === "https://test.local/original.png") return new Response(png, { headers: { "Content-Type": "image/png" } });
      assert.equal(url, "https://api.openai.com/v1/images/edits");
      assert.equal(options.body.get("model"), "gpt-image-2.5-sunburst-2026-09-08");
      assert.equal(options.body.get("quality"), "high");
      assert.equal(options.body.get("n"), "1");
      assert.equal(options.body.get("output_format"), "png");
      assert.equal(options.body.getAll("image[]").length, 1);
      assert.ok(options.body.get("prompt").startsWith(ARCHITECTURE_LOCK));
      assert.ok(!("Content-Type" in options.headers));
      return imageResult();
    };
    const result = await api.runOpenAiImageGeneration({ prompt: "Keep the windows", sourceImageUrl: "https://test.local/original.png" });
    assert.equal(result.modelName, "gpt-image-2.5-sunburst-2026-09-08");
    assert.equal(result.imageBase64, png.toString("base64"));
  });
  await test("Revision sends parent first, original architecture second; Concept selects Flare", async () => {
    globalThis.fetch = async (url, options) => {
      if (url.startsWith("https://test.local/")) return new Response(url.endsWith("parent.png") ? png : Buffer.from("original"), { headers: { "Content-Type": "image/png" } });
      assert.equal(options.body.get("model"), "gpt-image-2.5-flare");
      const files = options.body.getAll("image[]");
      assert.equal(files.length, 2);
      assert.deepEqual(Buffer.from(await files[0].arrayBuffer()), png);
      assert.equal(await files[1].text(), "original");
      assert.match(options.body.get("prompt"), /Image 2 is the original room photograph/);
      return imageResult();
    };
    await api.runOpenAiImageGeneration({ prompt: "Change only the rug", sourceImageUrl: "https://test.local/parent.png", architectureImageUrl: "https://test.local/original.png", renderMode: "concept" });
  });
  await test("Missing source never falls back to generation", async () => {
    globalThis.fetch = async () => { throw new Error("Unexpected request"); };
    await assert.rejects(api.runOpenAiImageGeneration({ prompt: "a room" }), /source room image is required/);
  });
  await test("Source fetch failure prevents a paid request", async () => {
    globalThis.fetch = async (url) => { assert.equal(url, "https://test.local/missing.png"); return new Response(null, { status: 404 }); };
    await assert.rejects(api.runOpenAiImageGeneration({ prompt: "a room", sourceImageUrl: "https://test.local/missing.png" }), /could not be loaded/);
  });
  await test("Missing image and unavailable model are failures, never successful renders", async () => {
    for (const response of [Response.json({ data: [] }), Response.json({ error: { message: "Model does not exist" } }, { status: 404 })]) {
      globalThis.fetch = async (url) => url.startsWith("https://test.local/") ? new Response(png, { headers: { "Content-Type": "image/png" } }) : response;
      await assert.rejects(api.runOpenAiImageGeneration({ prompt: "a room", sourceImageUrl: "https://test.local/original.png" }), /no image|does not exist/);
    }
  });
  await test("Quality and render mode reject invalid settings", async () => {
    assert.equal(renderModeSchema.safeParse("arbitrary-model").success, false);
    process.env.OPENAI_IMAGE_QUALITY = "invalid";
    await assert.rejects(api.runOpenAiImageGeneration({ prompt: "a room", sourceImageUrl: "https://test.local/original.png" }), /OPENAI_IMAGE_QUALITY/);
  });
  await test("Missing API key fails explicitly", async () => {
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(api.runOpenAiImageGeneration({ prompt: "a room", sourceImageUrl: "https://test.local/original.png" }), /not configured/);
  });
  await test("Organization verification has an actionable saved-work error", async () => {
    assert.match(api.imageFailureMessage(new Error("Your organization must be verified to use this model"), "fallback"), /verification.*saved/i);
    assert.equal(api.imageFailureMessage(new Error("timeout"), "fallback"), "fallback");
  });
  await test("Unreadable source photo has an actionable saved-work error", async () => {
    const message = api.imageFailureMessage(new Error("Invalid image file or mode for image 1, please check your image file."), "fallback");
    assert.match(message, /room photo could not be read/i);
    assert.match(message, /saved/i);
  });
  await test("Phone multi-picture JPEG drops the MPF index and the appended image", () => {
    const { bytes, changes } = normalizeSourceImageBytes(new Uint8Array(multiPictureJpeg));
    const out = Buffer.from(bytes);
    assert.deepEqual(changes.sort(), ["dropped_app2_mpf_index", `dropped_appended_image_bytes:${appendedGainMap.length}`]);
    assert.equal(out.includes(Buffer.from("MPF\0", "latin1")), false);
    // EXIF orientation, the ICC profile and every scan byte survive untouched.
    assert.ok(out.includes(Buffer.from("Exif\0\0orientation", "latin1")));
    assert.ok(out.includes(Buffer.from("ICC_PROFILE\0colour", "latin1")));
    assert.ok(out.includes(primaryScan));
    assert.equal(out.length, multiPictureJpeg.length - appendedGainMap.length - mpfSegment.length);
  });
  await test("Ordinary JPEG, PNG and malformed bytes are returned untouched", () => {
    const plainJpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), segment(0xe0, Buffer.from("JFIF\0", "latin1")), primaryScan]);
    for (const input of [plainJpeg, png, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]), Buffer.alloc(0)]) {
      const { bytes, changes } = normalizeSourceImageBytes(new Uint8Array(input));
      assert.deepEqual(changes, []);
      assert.deepEqual(Buffer.from(bytes), input);
    }
  });
  await test("The edit request uploads normalized bytes and records what changed", async () => {
    process.env.OPENAI_API_KEY = "contract-test-key";
    delete process.env.OPENAI_IMAGE_QUALITY;
    let uploaded = null;
    globalThis.fetch = async (url, options) => {
      if (url.startsWith("https://test.local/")) return new Response(multiPictureJpeg, { headers: { "Content-Type": "image/jpeg" } });
      uploaded = Buffer.from(await options.body.getAll("image[]")[0].arrayBuffer());
      return imageResult();
    };
    const result = await api.runOpenAiImageGeneration({ prompt: "a room", sourceImageUrl: "https://test.local/phone.jpg" });
    assert.equal(uploaded.includes(Buffer.from("MPF\0", "latin1")), false);
    assert.ok(uploaded.length < multiPictureJpeg.length);
    assert.deepEqual(result.requestBody.source_image_normalizations, ["image_1:dropped_app2_mpf_index", `image_1:dropped_appended_image_bytes:${appendedGainMap.length}`]);
    assert.equal(result.requestBody.quality, "high");
  });
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
console.log(`${checks} OpenAI render contract checks passed.`);
