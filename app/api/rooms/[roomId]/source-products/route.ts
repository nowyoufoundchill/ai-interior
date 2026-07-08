import { NextResponse } from "next/server";
import { productSourcingAgent } from "@/lib/ai/services";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif"
};

/**
 * Best-effort caching of hotlinked product images into our own Storage bucket so
 * the UI does not depend on external retailer hotlinks staying alive. Failures
 * are non-fatal: the product keeps its original `image_url` and simply has no
 * `cached_image_path`. Bounded by a short per-image timeout so a slow retailer
 * cannot stall the request.
 */
async function cacheProductImages(roomId: string, products: { id: string; image_url: string | null }[]) {
  const service = createServiceSupabaseClient();

  await Promise.all(
    products.map(async (product) => {
      if (!product.image_url || !/^https?:\/\//i.test(product.image_url)) return;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(product.image_url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) return;

        const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
        const extension = IMAGE_EXTENSIONS[contentType];
        if (!extension) return;

        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!bytes.length) return;

        const storagePath = `${roomId}/products/${product.id}.${extension}`;
        const { error: uploadError } = await service.storage.from("room-photos").upload(storagePath, bytes, {
          contentType,
          cacheControl: "3600",
          upsert: true
        });
        if (uploadError) return;

        const { data: publicUrlData } = service.storage.from("room-photos").getPublicUrl(storagePath);
        await service.from("products").update({ cached_image_path: publicUrlData.publicUrl }).eq("id", product.id).eq("room_id", roomId);
      } catch {
        // Non-fatal: fall back to the original hotlinked image_url.
      }
    })
  );
}

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

  const { data: latestDiagnosis } = await supabase
    .from("room_analyses")
    .select("*")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: designPreferences } = home
    ? await supabase.from("design_preferences").select("preference_type, label").eq("home_id", home.id)
    : { data: [] };

  let products;
  try {
    products = await productSourcingAgent({
      room,
      home,
      analysis: latestDiagnosis?.analysis,
      selectedMoodBoard,
      designPreferences: designPreferences ?? []
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

  await cacheProductImages(roomId, (data ?? []).map((product) => ({ id: product.id, image_url: product.image_url })));

  await supabase.from("rooms").update({ status: "products", current_stage: "executing" }).eq("id", roomId);

  const { data: refreshed } = await supabase
    .from("products")
    .select("*")
    .eq("room_id", roomId)
    .in("id", (data ?? []).map((product) => product.id));

  return NextResponse.json({ products: refreshed ?? data });
}
