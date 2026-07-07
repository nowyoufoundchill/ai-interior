import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const batchArg = process.argv[2];
if (!batchArg) {
  throw new Error("Pass the batch summary path, for example: spike/runs/batch/<timestamp>/summary.json");
}

const batchSummaryPath = path.resolve(repoRoot, batchArg);
const summary = JSON.parse(await fs.readFile(batchSummaryPath, "utf8"));
const evaluations = [];

for (const item of summary.filter((entry) => entry.status === "completed")) {
  const artifactPath = path.resolve(repoRoot, item.artifact_path);
  const artifact = JSON.parse(await fs.readFile(artifactPath, "utf8"));
  const evaluation = await evaluateArtifact(artifact);
  const outputPath = artifactPath.replace(/\.json$/i, ".evaluation.json");
  await fs.writeFile(outputPath, JSON.stringify(evaluation, null, 2), "utf8");
  evaluations.push({
    variant: item.variant,
    slug: item.slug,
    artifact_path: item.artifact_path,
    evaluation_path: path.relative(repoRoot, outputPath).replaceAll("\\", "/"),
    ...evaluation
  });
  console.log(`Evaluated ${item.variant}: overall ${evaluation.overall_score}`);
}

const ranked = [...evaluations].sort((left, right) => right.overall_score - left.overall_score);
const reportPath = batchSummaryPath.replace(/summary\.json$/i, "evaluation-summary.json");
await fs.writeFile(reportPath, JSON.stringify(ranked, null, 2), "utf8");

console.log(`\nEvaluation complete. Report saved to ${path.relative(repoRoot, reportPath).replaceAll("\\", "/")}`);
for (const entry of ranked) {
  console.log(`- ${entry.variant}: ${entry.overall_score} (${entry.winner_reason})`);
}

async function evaluateArtifact(artifact) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const prompt = [
    "You are an expert evaluator for a staged AI interior design workflow.",
    "Score the workflow result for the given room and brief.",
    "Be tough, specific, and practical.",
    "Reward outputs that are room-aware, geographically intelligent, original, and faithful to the brief.",
    "Penalize generic luxury language, weak concept differentiation, poor design dissent, weak coastal restraint, or failure to use lighting/openings intelligently.",
    "Return only JSON."
  ].join(" ");

  const input = {
    task: "Evaluate this staged workflow result.",
    rubric: {
      brief_fidelity: "How well the result satisfies the stated design brief and constraints.",
      context_intelligence: "How well it uses room architecture, natural light, geography, and whole-home notes.",
      creative_quality: "How fresh, specific, and non-generic the design ideas feel.",
      concept_differentiation: "How distinct the three concepts are from one another.",
      practical_accuracy: "How realistic the layout, scale, circulation, and execution logic feel.",
      dissent_quality: "How well the workflow challenges bad or weak user assumptions when appropriate.",
      render_readiness: "How production-ready and precise the render plan feels.",
      overall_score: "Overall score from 1-10."
    },
    room_input: artifact.config,
    diagnosis: artifact.workspace_snapshot.analyses?.[0]?.analysis ?? artifact.responses?.diagnosis ?? null,
    concepts: (artifact.workspace_snapshot.mood_boards ?? []).map((board) => ({
      concept_name: board.concept_name,
      concept_data: board.concept_data,
      status: board.status,
      quality_score: board.quality_score
    })),
    selected_concept: artifact.responses?.locked_concept?.mood_board ?? null,
    products: artifact.workspace_snapshot.products ?? [],
    render: artifact.workspace_snapshot.renders?.[0] ?? artifact.responses?.render?.render ?? null
  };

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      brief_fidelity: { type: "number" },
      context_intelligence: { type: "number" },
      creative_quality: { type: "number" },
      concept_differentiation: { type: "number" },
      practical_accuracy: { type: "number" },
      dissent_quality: { type: "number" },
      render_readiness: { type: "number" },
      overall_score: { type: "number" },
      winner_reason: { type: "string" },
      main_failures: {
        type: "array",
        items: { type: "string" }
      },
      prompt_changes: {
        type: "array",
        items: { type: "string" }
      },
      context_brain_changes: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: [
      "brief_fidelity",
      "context_intelligence",
      "creative_quality",
      "concept_differentiation",
      "practical_accuracy",
      "dissent_quality",
      "render_readiness",
      "overall_score",
      "winner_reason",
      "main_failures",
      "prompt_changes",
      "context_brain_changes"
    ]
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini-2026-03-17",
      instructions: prompt,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: JSON.stringify(input) }]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "workflow_evaluation",
          strict: true,
          schema
        },
        verbosity: "low"
      },
      reasoning: { effort: "low" },
      store: false
    }),
    signal: AbortSignal.timeout(180000)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof payload?.error?.message === "string" ? payload.error.message : "Evaluation request failed.");
  }

  const outputText =
    typeof payload?.output_text === "string"
      ? payload.output_text
      : payload?.output?.find?.((item) => Array.isArray(item.content))?.content?.find?.((content) => content.type === "output_text")?.text;

  if (!outputText) {
    throw new Error("Evaluation response did not include output text.");
  }

  return JSON.parse(outputText);
}
