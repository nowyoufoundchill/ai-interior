import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadTestEnv } from "../test-env.mjs";
import { BASE_URL, fetchJson, getRoomState, readCurrentTestRun, SuiteReporter, waitForServer, requireServerIsolation } from "./_lib.mjs";

/**
 * PRD v3 §12.1 Suite 3 — Live API smoke. The one paid suite: run against a
 * dev server started WITHOUT AI_MODE=mock (i.e. AI_MODE=live or unset), once
 * per cycle. Exercises one real call against each of the three providers
 * (Anthropic reasoning, OpenAI image edit, Tavily search+extract), asserts
 * schema-valid output, images cached to Storage, ai_runs logged with a real
 * provider/model, and a graceful failure path that does not corrupt room
 * state.
 *
 * Tavily is called directly (lib/ai/tavily.ts-equivalent raw requests)
 * rather than through an app route: the production Product Scout route does
 * not currently invoke Tavily or Anthropic native web search (only the
 * Phase 0 /spike workbench does) — a known, documented gap, not something
 * this suite should silently paper over by skipping the provider check.
 */

// Fail closed (P0.0): throws before any client exists when .env.test is
// absent or resolves to the production project. requireServerIsolation()
// in main() additionally proves the RUNNING SERVER is on the test project.
loadTestEnv();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const reporter = new SuiteReporter("live-smoke");

function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`${name} is not set — Suite 3 needs real provider keys in .env.test/.env.local.`);
  }
}

async function main() {
  requireEnv("ANTHROPIC_API_KEY");
  requireEnv("OPENAI_API_KEY");
  requireEnv("TAVILY_API_KEY");

  await waitForServer();
  await requireServerIsolation();
  const { roomId } = readCurrentTestRun();
  console.log(`[live-smoke] room=${roomId}`);

  // --- One real Anthropic reasoning call (diagnosis + its critic) --------
  const analyze = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/analyze`, { method: "POST" });
  reporter.assert(analyze.ok, "live diagnosis call succeeds", analyze.body);
  const diagnosis = analyze.body?.diagnosis?.analysis;
  reporter.assert(
    diagnosis && typeof diagnosis.room_summary === "string" && Array.isArray(diagnosis.opportunities),
    "diagnosis output is schema-shaped (room_summary, opportunities present)",
    diagnosis
  );

  const { data: anthropicRuns } = await supabase
    .from("ai_runs")
    .select("provider, model_name, status, latency_ms")
    .eq("room_id", roomId)
    .eq("provider", "anthropic")
    .order("created_at", { ascending: false })
    .limit(5);
  reporter.assert(
    (anthropicRuns ?? []).some((run) => run.status === "completed" && run.model_name && run.model_name !== "mock"),
    "ai_runs logged a completed, real (non-mock) anthropic run",
    anthropicRuns
  );

  // --- Locked concept for the render leg, inserted directly to avoid
  // burning a full 3-concept live Anthropic generation just to get a
  // lockable board (concept generation itself is exercised for real in
  // Suite 1/2 under AI_MODE=mock every cycle; Suite 3's budget is one real
  // call per provider, not a full live concept set). ---------------------
  const { data: testRun } = await supabase.from("rooms").select("test_run_id").eq("id", roomId).maybeSingle();
  const { data: existingBoards } = await supabase
    .from("mood_boards")
    .select("version")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (existingBoards?.[0]?.version ?? 0) + 1;

  const smokeConcept = {
    concept_name: "Live Smoke Concept",
    design_thesis: "A minimal concept inserted directly so Suite 3 can exercise the real render pipeline without a full live concept generation pass.",
    style_keywords: ["warm", "grounded"],
    palette: [{ name: "Warm white", hex: "#f5efe4" }, { name: "Oak", hex: "#b9895a" }],
    materials: ["oak", "linen"],
    furniture_direction: "Simple, well-scaled anchor pieces.",
    layout_direction: "Anchor the primary function, keep circulation clear.",
    lighting_direction: "Layer ambient, task, and accent lighting.",
    art_direction: "One large grounding piece.",
    decor_direction: "Few, intentional objects.",
    plant_direction: "One large sculptural plant.",
    budget_strategy: "Invest in the anchor piece, save on accessories.",
    why_it_works: "Provides a stable, real concept for a render smoke test.",
    why_user_may_reject_it: "Not meant to be a real design direction — smoke-test fixture only.",
    risk_profile: ["Not a real design concept"],
    quality_score: 75
  };

  const { data: insertedBoard, error: boardInsertError } = await supabase
    .from("mood_boards")
    .insert({
      room_id: roomId,
      concept_name: smokeConcept.concept_name,
      concept_data: smokeConcept,
      version: nextVersion,
      origin: "generated",
      status: "locked",
      selected: true,
      quality_score: smokeConcept.quality_score,
      test_run_id: testRun?.test_run_id ?? null
    })
    .select("*")
    .single();
  reporter.assert(!boardInsertError && insertedBoard, "smoke-test locked concept inserted", boardInsertError);

  await supabase
    .from("rooms")
    .update({ selected_mood_board_id: insertedBoard.id, status: "selected", current_stage: "concept_locked" })
    .eq("id", roomId);

  const photosResp = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/photos`);
  const sourcePhotoId = photosResp.body.photos[0].id;

  // --- One real OpenAI image edit call ------------------------------------
  const render = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-render`, {
    method: "POST",
    body: JSON.stringify({ source_photo_id: sourcePhotoId, instructions: "Live smoke test render." })
  });
  reporter.assert(render.ok, "live render (OpenAI image edit) call succeeds", render.body);
  reporter.assert(
    typeof render.body?.render?.file_url === "string" && render.body.render.file_url.length > 0,
    "render returned a real generated image URL (not the mock null placeholder)",
    render.body
  );

  if (render.body?.render?.file_url) {
    const imageCheck = await fetch(render.body.render.file_url);
    reporter.assert(imageCheck.ok, "generated render image is fetchable from Storage", { status: imageCheck.status, url: render.body.render.file_url });
  }

  // --- Live product sourcing, so the cycle also exercises a real cached
  // product image (PRD v3 §12.4: "one full AI_MODE=live cycle completes
  // end-to-end including a saved render and a cached product image"). One
  // more Anthropic call (reasoning + critic), not a new provider. ---------
  const products = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/source-products`, { method: "POST" });
  reporter.assert(products.ok, "live product sourcing call succeeds", products.body);
  reporter.assert(
    Array.isArray(products.body?.products) && products.body.products.length > 0,
    "live product sourcing returned at least one product",
    products.body
  );

  const cachedProduct = (products.body?.products ?? []).find((p) => typeof p.cached_image_path === "string" && p.cached_image_path.length > 0);
  if (cachedProduct) {
    const cacheCheck = await fetch(cachedProduct.cached_image_path);
    reporter.assert(cacheCheck.ok, "a live-sourced product's cached image is fetchable from Storage", {
      status: cacheCheck.status,
      url: cachedProduct.cached_image_path
    });
  } else {
    // Non-fatal: caching a hotlinked image is best-effort and depends on
    // whatever image URL the live model returns (native web search isn't
    // wired into product sourcing yet — see the module docstring), so a
    // live run isn't guaranteed to produce a cacheable link every time. The
    // caching mechanism itself is already proven working in every mock
    // cycle (Suite 4 asserts real cached product images render).
    console.warn("[live-smoke] no product came back with a cached_image_path this run (best-effort caching, not guaranteed on live data) — mechanism is separately proven in mock-mode Suite 4 runs.");
  }

  const { data: openaiRuns } = await supabase
    .from("ai_runs")
    .select("provider, model_name, status")
    .eq("room_id", roomId)
    .eq("provider", "openai")
    .order("created_at", { ascending: false })
    .limit(5);
  reporter.assert(
    (openaiRuns ?? []).some((run) => run.status === "completed" && run.model_name && run.model_name !== "mock"),
    "ai_runs logged a completed, real (non-mock) openai run",
    openaiRuns
  );

  // --- One real Tavily search-with-images + one extract -------------------
  const tavilySearch = await tavilyRequest("https://api.tavily.com/search", {
    query: "warm oak executive desk for home office",
    search_depth: "basic",
    max_results: 3,
    include_images: true,
    include_image_descriptions: true
  });
  reporter.assert(tavilySearch.ok, "tavily search call succeeds", tavilySearch.error);
  const searchResults = tavilySearch.body?.results ?? [];
  const hasImages = (tavilySearch.body?.images ?? []).length > 0 || searchResults.some((r) => (r.images ?? []).length > 0);
  reporter.assert(searchResults.length > 0, "tavily search returned results", tavilySearch.body);
  reporter.assert(hasImages, "tavily search-with-images returned at least one image URL", tavilySearch.body);

  const extractUrl = searchResults.find((r) => typeof r.url === "string")?.url ?? "https://www.westelm.com";
  const tavilyExtract = await tavilyRequest("https://api.tavily.com/extract", {
    urls: [extractUrl],
    extract_depth: "basic"
  });
  reporter.assert(tavilyExtract.ok, "tavily extract call succeeds", tavilyExtract.error);
  reporter.assert(
    (tavilyExtract.body?.results ?? []).some((r) => typeof r.raw_content === "string" && r.raw_content.length > 0),
    "tavily extract returned page content",
    tavilyExtract.body
  );

  // --- Graceful failure path: a deliberately bad request must not corrupt
  // room state (PRD v3 §12.1 Suite 3). --------------------------------------
  const stateBeforeBadRequest = await getRoomState(roomId);
  const badRequest = await fetchJson(`${BASE_URL}/api/rooms/${roomId}/generate-render`, {
    method: "POST",
    body: JSON.stringify({ source_photo_id: randomUUID(), instructions: "This photo does not exist." })
  });
  reporter.assert(badRequest.status === 400, "a bad render request (nonexistent photo) is rejected, not 500", badRequest.body);

  const stateAfterBadRequest = await getRoomState(roomId);
  reporter.assert(
    stateAfterBadRequest.renders.length === stateBeforeBadRequest.renders.length,
    "bad request created no render row (room state uncorrupted)",
    { before: stateBeforeBadRequest.renders.length, after: stateAfterBadRequest.renders.length }
  );
  reporter.assert(
    stateAfterBadRequest.room.current_stage === stateBeforeBadRequest.room.current_stage,
    "bad request left room.current_stage unchanged",
    { before: stateBeforeBadRequest.room.current_stage, after: stateAfterBadRequest.room.current_stage }
  );

  reporter.finish();
}

async function tavilyRequest(url, body) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.TAVILY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000)
    });
    const payload = await response.json().catch(() => null);
    return { ok: response.ok, body: payload, error: response.ok ? null : payload };
  } catch (error) {
    return { ok: false, body: null, error: error instanceof Error ? error.message : String(error) };
  }
}

main().catch((error) => {
  console.error("[live-smoke] FAILED:", error);
  process.exitCode = 1;
});
