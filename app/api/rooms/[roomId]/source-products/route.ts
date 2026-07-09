import { NextResponse } from "next/server";
import { critiqueProducts } from "@/lib/ai/critic";
import { productSourcingAgent } from "@/lib/ai/services";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import type { ProductPlanItem } from "@/lib/schemas";

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif"
};

async function validateSourceUrl(url: string | null | undefined) {
  if (!url || !/^https?:\/\//i.test(url)) return false;

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(7000),
      headers: {
        "User-Agent": "AI Interior Atelier product validation"
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchImageBytes(url: string | null | undefined) {
  if (!url || !/^https?:\/\//i.test(url)) return null;

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "AI Interior Atelier image validation"
      }
    });
    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const extension = IMAGE_EXTENSIONS[contentType];
    if (!extension) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 1024) return null;

    return { bytes, contentType, extension };
  } catch {
    return null;
  }
}

async function validateAndCacheProducts(roomId: string, products: ProductPlanItem[]) {
  const service = createServiceSupabaseClient();
  const verified: Array<{ product: ProductPlanItem; cachedImagePath: string }> = [];

  for (const product of products) {
    const [sourceOk, image] = await Promise.all([validateSourceUrl(product.url), fetchImageBytes(product.image_url)]);
    if (!sourceOk || !image) continue;

    const storagePath = `${roomId}/products/${crypto.randomUUID()}.${image.extension}`;
    const { error: uploadError } = await service.storage.from("room-photos").upload(storagePath, image.bytes, {
      contentType: image.contentType,
      cacheControl: "86400",
      upsert: false
    });
    if (uploadError) continue;

    const { data: publicUrlData } = service.storage.from("room-photos").getPublicUrl(storagePath);
    verified.push({ product, cachedImagePath: publicUrlData.publicUrl });
  }

  return verified;
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

  const { data: currentRender } = await supabase
    .from("renders")
    .select("*")
    .eq("room_id", roomId)
    .neq("status", "stale")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!currentRender) {
    return NextResponse.json({ error: "Edit a room photo before sourcing products." }, { status: 400 });
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
      approvedRender: currentRender,
      designPreferences: designPreferences ?? []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product sourcing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const verifiedProducts = await validateAndCacheProducts(roomId, products);

  if (verifiedProducts.length < 4) {
    return NextResponse.json(
      { error: "Not enough sourced products passed source-link, image, and category validation. Try again with a narrower approved direction." },
      { status: 502 }
    );
  }

  try {
    await critiqueProducts({
      roomId,
      products: verifiedProducts.map((entry) => entry.product),
      concept: selectedMoodBoard.concept_data,
      diagnosis: latestDiagnosis?.analysis,
      approvedRender: currentRender,
      contextBrain: {
        approved_render: {
          id: currentRender.id,
          file_url: currentRender.file_url,
          transformation_instructions: currentRender.transformation_instructions,
          user_regeneration_instructions: currentRender.user_regeneration_instructions
        }
      }
    });
  } catch {
    // Critic logging is valuable, but a critic outage should not discard
    // already validated, real sourced products.
  }

  const { data, error } = await supabase
    .from("products")
    .insert(
      verifiedProducts.map(({ product, cachedImagePath }) => ({
        room_id: roomId,
        mood_board_id: selectedMoodBoard.id,
        mood_board_version: selectedMoodBoard.version ?? null,
        category: product.category,
        name: product.name,
        retailer: product.retailer,
        url: product.url,
        image_url: product.image_url,
        cached_image_path: cachedImagePath,
        price: product.price,
        dimensions: product.dimensions,
        material: product.material,
        finish: product.finish,
        scores: product.scores,
        reason_selected: product.reason_selected,
        risks: product.risks,
        alternatives: product.alternatives,
        status: "suggested",
        test_run_id: room.test_run_id
      }))
    )
    .select("*");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("rooms").update({ status: "products", current_stage: "executing" }).eq("id", roomId);

  const { data: refreshed } = await supabase
    .from("products")
    .select("*")
    .eq("room_id", roomId)
    .in("id", (data ?? []).map((product) => product.id));

  return NextResponse.json({ products: refreshed ?? data });
}
