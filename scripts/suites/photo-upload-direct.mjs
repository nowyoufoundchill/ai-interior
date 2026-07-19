import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { loadTestEnv } from "../test-env.mjs";
import { BASE_URL, readCurrentTestRun, requireServerIsolation, SuiteReporter, waitForServer } from "./_lib.mjs";

const reporter = new SuiteReporter("photo-upload-direct");

async function main() {
  loadTestEnv();
  await waitForServer();
  const { serverAiMode } = await requireServerIsolation();
  if (serverAiMode !== "mock") throw new Error(`Direct upload gate requires AI_MODE=mock (got ${serverAiMode}).`);
  const { testRunId, homeId } = readCurrentTestRun();
  const source = readFileSync(path.join(process.cwd(), "spike", "input-images", "IMG_1126.jpg"));
  const largeJpeg = Buffer.concat([source, Buffer.alloc(6 * 1024 * 1024 - source.length)]);
  reporter.assert(largeJpeg.length > 4.5 * 1024 * 1024, "fixture exceeds Vercel's function request limit", largeJpeg.length);

  const appUploadRequests = [];
  const signedStorageRequests = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "POST" && url.origin === new URL(BASE_URL).origin && /\/api\/rooms\/[^/]+\/photos(?:\/upload-url)?$/.test(url.pathname)) {
      appUploadRequests.push({ path: url.pathname, contentType: request.headers()["content-type"] ?? "", bytes: request.postDataBuffer()?.length ?? 0 });
    }
    if (url.hostname.endsWith("supabase.co") && url.pathname.includes("/storage/v1/object/upload/sign/")) {
      signedStorageRequests.push({ path: url.pathname, bytes: request.postDataBuffer()?.length ?? 0 });
    }
  });

  try {
    await page.goto(`${BASE_URL}/homes/${homeId}/rooms/new`, { waitUntil: "networkidle" });
    await page.getByTestId("autopilot-photo-input").setInputFiles({ name: "large-room-photo.jpg", mimeType: "image/jpeg", buffer: largeJpeg });
    await page.getByTestId("autopilot-outcome-input").fill("Make this a calm reading room with practical storage.");
    await page.getByTestId("autopilot-room-name-input").fill("Large upload room");
    await page.getByTestId("autopilot-intake-submit").click();
    await page.waitForURL(/\/rooms\/[0-9a-f-]{36}$/, { timeout: 90000 });
    const roomId = new URL(page.url()).pathname.split("/").pop();

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: photos, error: photoError } = await supabase.from("photos").select("id, room_id, storage_path, file_url, test_run_id").eq("room_id", roomId);
    const photo = photos?.[0];
    const { data: object, error: objectError } = photo
      ? await supabase.storage.from("room-photos").info(photo.storage_path)
      : { data: null, error: null };

    reporter.assert(appUploadRequests.length === 2, "the app receives only authorization and finalization requests", appUploadRequests);
    reporter.assert(appUploadRequests.every((request) => request.contentType.includes("application/json") && request.bytes < 100_000), "no photo bytes pass through a Vercel function", appUploadRequests);
    reporter.assert(signedStorageRequests.length === 1, "the browser sends the photo directly to signed Supabase Storage", signedStorageRequests);
    reporter.assert(!photoError && photos?.length === 1 && photo?.test_run_id === testRunId, "one tagged photo row is persisted for the created room", { photoError: photoError?.message, photos });
    reporter.assert(!objectError && object?.size === largeJpeg.length, "the complete large image exists in Storage", { objectError: objectError?.message, size: object?.size, expected: largeJpeg.length });
    reporter.assert(photo?.storage_path.startsWith(`test-runs/${testRunId}/${roomId}-`), "the signed object is scoped to its room and tagged teardown prefix", photo?.storage_path);
    reporter.assert(await page.getByTestId("current-design").count() === 1, "the uploaded photo is immediately available in the room workspace");
  } finally {
    await browser.close();
  }
  reporter.finish();
}

main().catch((error) => {
  console.error("[photo-upload-direct] FAILED:", error.message);
  reporter.assert(false, "suite completed without an unhandled error", error.message);
  reporter.finish();
});
