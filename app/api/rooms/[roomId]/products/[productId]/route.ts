import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ACTION_TO_STATUS: Record<string, string> = {
  approve: "approved",
  reject: "rejected",
  reset: "suggested"
};

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string; productId: string }> }) {
  const { roomId, productId } = await params;
  const body = await request.json().catch(() => ({}));
  const status = typeof body.action === "string" ? ACTION_TO_STATUS[body.action] : undefined;

  if (!status) {
    return NextResponse.json({ error: "Unknown product action." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .update({ status })
    .eq("id", productId)
    .eq("room_id", roomId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Product was not found for this room." }, { status: 404 });

  return NextResponse.json({ product: data });
}
