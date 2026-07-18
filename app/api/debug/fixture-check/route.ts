import { NextResponse } from "next/server";
import { z } from "zod";
import { critiqueRender, reviewFinishedImage } from "@/lib/ai/critic";
import { FixtureFailureError, activeFailureFixture } from "@/lib/ai/failure-fixtures";
import { generateImageEdit, runStructuredTask } from "@/lib/ai/gateway";
import { currentCorrelationId } from "@/lib/observability";
import type { RenderPlan } from "@/lib/schemas";

/**
 * P0.0 failure-fixture self-check (debug-only, AI_MODE=mock only). Exercises
 * the gateway/critic/image fixture boundaries directly so every named
 * provider-side failure class is provably triggerable without a paid call
 * and without touching room state. Storage/persistence fixtures live in the
 * render route (they need a real room) and are exercised by the suites.
 *
 * GET with header `x-test-failure-fixture: <fixture>`; requires
 * `?roomId=<seeded room>` so every ai_runs row this logs inherits that
 * room's test_run_id (an untagged row would be invisible to the residue
 * check — the exact leak class fixed on 2026-07-08); optionally
 * `&boundary=structured|image|critic|finished-image` (default structured).
 */
export async function GET(request: Request) {
  if (process.env.AI_MODE !== "mock") {
    return NextResponse.json({ error: "fixture-check is only available when AI_MODE=mock." }, { status: 400 });
  }

  const url = new URL(request.url);
  const roomId = url.searchParams.get("roomId");
  if (!roomId) {
    return NextResponse.json(
      { error: "fixture-check requires ?roomId=<seeded room id> so its ai_runs rows carry that room's test_run_id." },
      { status: 400 }
    );
  }
  const boundary = url.searchParams.get("boundary") ?? "structured";
  const fixture = await activeFailureFixture();
  const correlationId = await currentCorrelationId();
  const startedAt = Date.now();

  try {
    if (boundary === "finished-image") {
      const review = await reviewFinishedImage({
        roomId,
        sourceImageUrl: "https://fixtures.invalid/p1-3/source.jpg",
        finishedImageUrl: "https://fixtures.invalid/p1-3/finished.jpg",
        brief: {
          room_summary: "Seeded office used only to exercise the finished-image review boundary.",
          design_direction: "Calm, warm, functional office",
          functions_and_zones: ["unobstructed access", "work zone", "reading zone"],
          fixed_architecture: ["window", "structural post", "ventilation grille"],
          keep_or_remove: ["keep fixed architecture"],
          palette_materials_lighting: ["warm wood", "soft neutral walls"],
          preservation_constraints: ["preserve window, post, vent, access, and camera"],
          negative_instructions: ["do not move openings or block access"],
          unknowns: ["exact clearances require field measurement"],
          blocking_questions: [],
          confidence: 0.95
        },
        typedFacts: { room_type: "office", required_zones: ["work zone", "reading zone"] }
      });
      return NextResponse.json({
        ok: true,
        boundary,
        fixture,
        correlation_id: correlationId,
        elapsed_ms: Date.now() - startedAt,
        review
      });
    } else if (boundary === "image") {
      await generateImageEdit({
        roomId,
        serviceName: "Fixture Check (image)",
        promptVersion: "fixture-check",
        prompt: "fixture check"
      });
    } else if (boundary === "critic") {
      const minimalPlan = {
        render_prompt: "fixture check",
        preservation_constraints: [],
        transformation_instructions: [],
        negative_instructions: []
      } as unknown as RenderPlan;
      const critique = await critiqueRender({
        roomId,
        plan: minimalPlan,
        contextBrain: {}
      });
      return NextResponse.json({
        ok: true,
        boundary,
        fixture,
        correlation_id: correlationId,
        elapsed_ms: Date.now() - startedAt,
        blocking_violations: critique.blocking_violations
      });
    } else {
      await runStructuredTask({
        roomId,
        serviceName: "Fixture Check (structured)",
        provider: "mock",
        promptPath: "prompts/critic/score-render.v1.md",
        schemaName: "fixture_check",
        schema: { type: "object" },
        zodSchema: z.object({ ok: z.boolean() }),
        taskInput: { fixture_check: true },
        mock: () => ({ ok: true })
      });
    }

    return NextResponse.json({
      ok: true,
      boundary,
      fixture,
      correlation_id: correlationId,
      elapsed_ms: Date.now() - startedAt
    });
  } catch (error) {
    const isFixture = error instanceof FixtureFailureError;
    return NextResponse.json(
      {
        ok: false,
        boundary,
        fixture,
        correlation_id: correlationId,
        elapsed_ms: Date.now() - startedAt,
        error_code: isFixture ? error.errorCode : "unexpected_error",
        error: error instanceof Error ? error.message : String(error)
      },
      { status: isFixture ? 502 : 500 }
    );
  }
}
