"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SINGLE_HOUSEHOLD_USER_ID } from "@/lib/constants";
import { commaList, formNumber, formText } from "@/lib/data/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createHomeAction(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const name = formText(formData, "name");

  if (!name) {
    throw new Error("Home name is required.");
  }

  const { data, error } = await supabase
    .from("homes")
    .insert({
      user_id: SINGLE_HOUSEHOLD_USER_ID,
      name,
      region: formText(formData, "region"),
      home_type: formText(formData, "home_type"),
      style_notes: formText(formData, "style_notes"),
      whole_home_palette: commaList(formText(formData, "whole_home_palette")),
      whole_home_constraints: commaList(formText(formData, "whole_home_constraints"))
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  redirect(`/homes/${data.id}`);
}

export async function createRoomAction(homeId: string, formData: FormData) {
  const supabase = createServerSupabaseClient();
  const name = formText(formData, "name");

  if (!name) {
    throw new Error("Room name is required.");
  }

  const { data, error } = await supabase
    .from("rooms")
    .insert({
      home_id: homeId,
      name,
      room_type: formText(formData, "room_type"),
      purpose: formText(formData, "purpose"),
      dimensions: {
        width: formText(formData, "width"),
        length: formText(formData, "length"),
        notes: formText(formData, "dimension_notes")
      },
      ceiling_height: formNumber(formData, "ceiling_height"),
      budget_range: formText(formData, "budget_range"),
      style_preferences: commaList(formText(formData, "style_preferences")),
      color_preferences: commaList(formText(formData, "color_preferences")),
      constraints: commaList(formText(formData, "constraints")),
      existing_items: commaList(formText(formData, "existing_items")),
      design_brief: formText(formData, "design_brief"),
      status: "intake"
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/homes/${homeId}`);
  redirect(`/rooms/${data.id}`);
}
