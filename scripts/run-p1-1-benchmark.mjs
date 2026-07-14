import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-5.5";
if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const root = path.join(process.cwd(), "benchmarks", "private");
const report = { schema_version: 1, phase: "P1.1", run_id: runId, model, candidates: [], not_run: [] };

const cases = [
  {
    id: "OPENPLAN-01",
    promptFile: "manual-reference-prompt.txt",
    compactBrief:
      "Edit this exact source photograph in place into one photorealistic, quietly luxurious coastal contemporary connected living, dining, and kitchen space. Preserve the fireplace and surround, kitchen and island, exposed beams, windows, exterior door, ceiling fans, floor plane, proportions, and camera angle. Use warm whites, natural oak and walnut, limestone or travertine, linen and textured wool, restrained aged-brass accents, and comfortable correctly scaled furniture. Keep walkways clear; do not move, add, or remove architecture, openings, vents, or utilities."
  },
  {
    id: "CHILDROOM-01",
    promptFile: "original-expert-prompt.txt",
    compactBrief:
      "Edit this exact source photograph in place into one calm, high-quality, age-appropriate bedroom scenario with a coherent furnishing layout. Preserve both windows, the entry door, ceiling fan, wall grille, ceiling vents, floor plane, proportions, and camera angle. Keep door access clear and do not claim unmeasured clearances. Do not move, add, or remove architecture, openings, vents, or utilities. Use durable, warm, understated materials and realistic scale; avoid clutter, warped objects, and artificial-looking light."
  },
  {
    id: "GARAGE-01",
    promptFile: "original-prompt.txt",
    compactBrief:
      "Edit this exact source photograph in place into one premium, organized two-car garage benchmark scenario with a workshop, lawn-equipment storage, gym zone with squat rack/cable machine/adjustable bench, and surfboard storage. Preserve structural posts and exposed framing, windows and door openings, existing shelving, ceiling lights, floor plane, proportions, and camera angle. Use matte dark storage, durable work surfaces, rubber gym flooring only in the gym zone, and realistic clear circulation. Do not move, add, or remove architecture, openings, vents, or utilities; do not imply unmeasured vehicle or equipment clearances are verified."
  }
];

const selectedCaseIds = new Set((process.env.P11_CASES || cases.map((benchmark) => benchmark.id).join(",")).split(","));
const selectedPaths = new Set((process.env.P11_PATHS || "full_expert_prompt,compact_brief,current_application_pipeline").split(","));

for (const benchmark of cases.filter((item) => selectedCaseIds.has(item.id))) {
  const sourcePath = path.join(root, benchmark.id, "source.jpg");
  const source = await readFile(sourcePath);
  const sourceDataUrl = `data:image/jpeg;base64,${source.toString("base64")}`;

  if (selectedPaths.has("full_expert_prompt")) {
    if (benchmark.promptFile) {
      const prompt = await readFile(path.join(root, benchmark.id, benchmark.promptFile), "utf8");
      await runCandidate(benchmark.id, "full_expert_prompt", prompt, source, sourceDataUrl);
    } else {
      report.not_run.push({ case_id: benchmark.id, path: "full_expert_prompt", reason: "Original expert prompt was not supplied and was not reconstructed." });
    }
  }

  if (selectedPaths.has("compact_brief")) {
    await runCandidate(benchmark.id, "compact_brief", benchmark.compactBrief, source, sourceDataUrl);
  }
  if (selectedPaths.has("current_application_pipeline")) {
    report.not_run.push({ case_id: benchmark.id, path: "current_application_pipeline", reason: "The current application pipeline requires an application photo URL. Uploading private benchmark sources to the current public photo bucket would violate the private-asset contract." });
  }
}

await writeFile(path.join(root, `p1-1-run-${runId}.json`), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report));

async function runCandidate(caseId, pathName, prompt, source, sourceDataUrl) {
  const startedAt = Date.now();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: sourceDataUrl, detail: "high" }
          ]
        }
      ],
      tools: [{ type: "image_generation", action: "edit" }],
      store: false
    }),
    signal: AbortSignal.timeout(Number(process.env.OPENAI_TIMEOUT_MS || 120000))
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${caseId}/${pathName}: ${payload?.error?.message || "OpenAI image generation failed."}`);
  const output = payload?.output?.find((item) => item?.type === "image_generation_call" && typeof item?.result === "string");
  if (!output?.result) throw new Error(`${caseId}/${pathName}: response did not include an image.`);

  const result = Buffer.from(output.result, "base64");
  const targetDir = path.join(root, caseId, "candidates", runId);
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, `${pathName}.png`), result);
  report.candidates.push({
    case_id: caseId,
    path: pathName,
    status: "completed",
    source_sha256: sha256(source),
    prompt_sha256: sha256(Buffer.from(prompt)),
    result_sha256: sha256(result),
    result_bytes: result.length,
    elapsed_ms: Date.now() - startedAt,
    usage: payload?.usage ?? null,
    estimated_cost: null
  });
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
