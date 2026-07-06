import { NextResponse } from "next/server";
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
    .eq("status", "locked")
    .maybeSingle();

  if (!selectedMoodBoard) {
    return NextResponse.json({ error: "Select a mood board before sourcing products." }, { status: 400 });
  }

  const { data: latestAnalysis } = await supabase
    .from("room_analyses")
    .select("*")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
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
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("products")
    .insert(
      products.map((product) => ({
        room_id: roomId,
        mood_board_id: selectedMoodBoard.id,
        mood_board_version: selectedMoodBoard.version ?? null,
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
        status: "suggested"
      }))
    )
    .select("*");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("rooms").update({ status: "products", current_stage: "executing" }).eq("id", roomId);

  return NextResponse.json({ products: data });
}
