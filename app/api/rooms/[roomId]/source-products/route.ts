import { NextResponse } from "next/server";
import { logAiRun } from "@/lib/ai/logging";
import { productSourcingAgent } from "@/lib/ai/services";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(_: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const supabase = createServerSupabaseClient();
  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).single();

  if (roomError) return NextResponse.json({ error: roomError.message }, { status: 404 });

  const { data: home } = await supabase.from("homes").select("*").eq("id", room.home_id).maybeSingle();

  const { data: selectedMoodBoard } = await supabase
    .from("mood_boards")
    .select("*")
    .eq("room_id", roomId)
    .eq("selected", true)
    .maybeSingle();

  if (!selectedMoodBoard) {
    return NextResponse.json({ error: "Select a mood board before sourcing products." }, { status: 400 });
  }

  const { data: latestAnalysis } = await supabase
    .from("room_analyses")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let products;
  try {
    products = await productSourcingAgent({
      room,
      home,
      analysis: latestAnalysis?.analysis,
      selectedMoodBoard
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product sourcing failed.";
    await logAiRun({
      roomId,
      serviceName: "Product Sourcing Agent",
      promptVersion: "product_sourcing_v1",
      inputPayload: { room, selected_mood_board: selectedMoodBoard, analysis: latestAnalysis?.analysis ?? null },
      outputPayload: {},
      status: "failed",
      validationErrors: [message]
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("products")
    .insert(
      products.map((product) => ({
        room_id: roomId,
        mood_board_id: selectedMoodBoard?.id,
        category: product.category,
        name: product.name,
        retailer: product.retailer,
        url: product.url,
        image_url: product.image_url,
        price: product.price,
        dimensions: product.dimensions,
        material: product.material,
        finish: product.finish,
        scores: product.scores,
        reason_selected: product.reason_selected,
        risks: product.risks,
        alternatives: product.alternatives,
        status: "candidate"
      }))
    )
    .select("*");

  if (error) {
    await logAiRun({
      roomId,
      serviceName: "Product Sourcing Agent",
      promptVersion: "product_sourcing_v1",
      inputPayload: { room, selected_mood_board: selectedMoodBoard, analysis: latestAnalysis?.analysis ?? null },
      outputPayload: { products },
      status: "failed",
      validationErrors: [error.message]
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const insertedIds = (data ?? []).map((product) => product.id);
  if (insertedIds.length) {
    await supabase.from("products").delete().eq("room_id", roomId).not("id", "in", `(${insertedIds.join(",")})`);
  }

  await supabase.from("rooms").update({ status: "products" }).eq("id", roomId);
  await logAiRun({
    roomId,
    serviceName: "Product Sourcing Agent",
    promptVersion: "product_sourcing_v1",
    inputPayload: { room, selected_mood_board: selectedMoodBoard, analysis: latestAnalysis?.analysis ?? null },
    outputPayload: { products },
    qualityScore: 82
  });

  return NextResponse.json({ products: data });
}
