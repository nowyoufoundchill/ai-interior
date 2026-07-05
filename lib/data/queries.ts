import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Home = Database["public"]["Tables"]["homes"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Photo = Database["public"]["Tables"]["photos"]["Row"];
type Analysis = Database["public"]["Tables"]["room_analyses"]["Row"];
type MoodBoard = Database["public"]["Tables"]["mood_boards"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type Render = Database["public"]["Tables"]["renders"]["Row"];
type Revision = Database["public"]["Tables"]["revisions"]["Row"];
type Memory = Database["public"]["Tables"]["design_memories"]["Row"];
type AiRun = Database["public"]["Tables"]["ai_runs"]["Row"];

export type HomeSummary = Home & {
  rooms: Pick<Room, "id" | "name" | "room_type" | "status" | "created_at">[];
};

export type HomeDetail = Home & {
  rooms: Room[];
};

export type RoomWorkspaceData = {
  room: Room;
  home: Home | null;
  photos: Photo[];
  analyses: Analysis[];
  moodBoards: MoodBoard[];
  products: Product[];
  renders: Render[];
  revisions: Revision[];
  memories: Memory[];
  aiRuns: AiRun[];
};

export async function getHomes() {
  if (!isSupabaseConfigured()) return [];

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("homes")
    .select("*, rooms(id, name, room_type, status, created_at)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as HomeSummary[];
}

export async function getHome(homeId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("homes")
    .select("*, rooms(*)")
    .eq("id", homeId)
    .single();

  if (error) throw new Error(error.message);
  return data as HomeDetail;
}

export async function getRoomWorkspace(roomId: string): Promise<RoomWorkspaceData> {
  const supabase = createServerSupabaseClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*, homes(*)")
    .eq("id", roomId)
    .single();

  if (roomError) throw new Error(roomError.message);
  const roomWithHome = room as Room & { homes: Home | null };

  const [
    photos,
    analyses,
    moodBoards,
    products,
    renders,
    revisions,
    memories,
    aiRuns
  ] = await Promise.all([
    supabase.from("photos").select("*").eq("room_id", roomId).order("created_at", { ascending: false }),
    supabase.from("room_analyses").select("*").eq("room_id", roomId).order("created_at", { ascending: false }),
    supabase.from("mood_boards").select("*").eq("room_id", roomId).order("created_at", { ascending: true }),
    supabase.from("products").select("*").eq("room_id", roomId).order("created_at", { ascending: true }),
    supabase.from("renders").select("*").eq("room_id", roomId).order("created_at", { ascending: false }),
    supabase.from("revisions").select("*").eq("room_id", roomId).order("created_at", { ascending: false }),
    supabase.from("design_memories").select("*").eq("scope_id", roomId).order("created_at", { ascending: false }),
    supabase.from("ai_runs").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(12)
  ]);

  const errors = [photos, analyses, moodBoards, products, renders, revisions, memories, aiRuns]
    .map((result) => result.error)
    .filter(Boolean);

  if (errors[0]) throw new Error(errors[0].message);

  return {
    room: roomWithHome,
    home: roomWithHome.homes,
    photos: (photos.data ?? []) as Photo[],
    analyses: (analyses.data ?? []) as Analysis[],
    moodBoards: (moodBoards.data ?? []) as MoodBoard[],
    products: (products.data ?? []) as Product[],
    renders: (renders.data ?? []) as Render[],
    revisions: (revisions.data ?? []) as Revision[],
    memories: (memories.data ?? []) as Memory[],
    aiRuns: (aiRuns.data ?? []) as AiRun[]
  };
}
