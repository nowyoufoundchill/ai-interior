import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listProposals } from "@/lib/data/proposals";
import type { ActionProposal, Database } from "@/types/database";

type Home = Database["public"]["Tables"]["homes"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Photo = Database["public"]["Tables"]["photos"]["Row"];
type Diagnosis = Database["public"]["Tables"]["room_analyses"]["Row"];
type MoodBoard = Database["public"]["Tables"]["mood_boards"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type Render = Database["public"]["Tables"]["renders"]["Row"];
type Revision = Database["public"]["Tables"]["revisions"]["Row"];
type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];
type Memory = Database["public"]["Tables"]["design_memories"]["Row"];
type AiRun = Database["public"]["Tables"]["ai_runs"]["Row"];
type GenerationJob = Database["public"]["Tables"]["generation_jobs"]["Row"];
type ImplementationPackage = Database["public"]["Tables"]["implementation_packages"]["Row"];

export type HomeSummary = Home & {
  rooms: HomeRoom[];
};

export type HomeRoom = Pick<Room, "id" | "name" | "room_type" | "status" | "current_stage" | "created_at"> & {
  job_status?: string | null;
  job_type?: string | null;
  job_error_message?: string | null;
};

export type HomeDetail = Home & {
  rooms: (Room & Pick<HomeRoom, "job_status" | "job_type" | "job_error_message">)[];
};

export type RoomWorkspaceData = {
  room: Room;
  home: Home | null;
  photos: Photo[];
  diagnoses: Diagnosis[];
  moodBoards: MoodBoard[];
  products: Product[];
  renders: Render[];
  revisions: Revision[];
  chatMessages: ChatMessage[];
  actionProposals: ActionProposal[];
  memories: Memory[];
  aiRuns: AiRun[];
  generationJobs: GenerationJob[];
  implementationPackages: ImplementationPackage[];
};

export async function getHomes() {
  if (!isSupabaseConfigured()) return [];

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("homes")
    .select("*, rooms(id, name, room_type, status, current_stage, created_at)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const homes = (data ?? []) as HomeSummary[];
  const roomIds = homes.flatMap((home) => home.rooms.map((room) => room.id));
  if (!roomIds.length) return homes;

  // Keep navigation cards useful after a refresh. Only owner-actionable jobs
  // belong here; completed history would make a room look busy forever.
  const { data: jobs } = await supabase
    .from("generation_jobs")
    .select("room_id, job_type, status, error_message, created_at")
    .in("room_id", roomIds)
    .in("status", ["queued", "planning", "validating", "generating", "persisting", "retryable_failed", "terminal_failed"])
    .order("created_at", { ascending: false });
  const latest = new Map<string, { room_id: string; job_type: string; status: string; error_message: string | null }>();
  for (const job of jobs ?? []) if (!latest.has(job.room_id)) latest.set(job.room_id, job);
  return homes.map((home) => ({
    ...home,
    rooms: home.rooms.map((room) => {
      const job = latest.get(room.id);
      return { ...room, job_status: job?.status ?? null, job_type: job?.job_type ?? null, job_error_message: job?.error_message ?? null };
    })
  }));
}

export async function getHome(homeId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("homes")
    .select("*, rooms(*)")
    .eq("id", homeId)
    .single();

  if (error) throw new Error(error.message);
  const home = data as HomeDetail;
  const roomIds = home.rooms.map((room) => room.id);
  if (!roomIds.length) return home;
  const { data: jobs } = await supabase
    .from("generation_jobs")
    .select("room_id, job_type, status, error_message, created_at")
    .in("room_id", roomIds)
    .in("status", ["queued", "planning", "validating", "generating", "persisting", "retryable_failed", "terminal_failed"])
    .order("created_at", { ascending: false });
  const latest = new Map<string, { job_type: string; status: string; error_message: string | null }>();
  for (const job of jobs ?? []) if (!latest.has(job.room_id)) latest.set(job.room_id, job);
  return {
    ...home,
    rooms: home.rooms.map((room) => {
      const job = latest.get(room.id);
      return { ...room, job_status: job?.status ?? null, job_type: job?.job_type ?? null, job_error_message: job?.error_message ?? null };
    })
  } as HomeDetail;
}

export type DesignPreference = Database["public"]["Tables"]["design_preferences"]["Row"];

export async function getDesignPreferences(homeId: string): Promise<DesignPreference[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("design_preferences")
    .select("*")
    .eq("home_id", homeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DesignPreference[];
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
    chatMessages,
    memories,
    aiRuns
  ] = await Promise.all([
    supabase.from("photos").select("*").eq("room_id", roomId).order("created_at", { ascending: false }),
    supabase.from("room_analyses").select("*").eq("room_id", roomId).order("version", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("mood_boards").select("*").eq("room_id", roomId).order("version", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("products").select("*").eq("room_id", roomId).order("created_at", { ascending: true }),
    supabase.from("renders").select("*").eq("room_id", roomId).order("created_at", { ascending: false }),
    supabase.from("revisions").select("*").eq("room_id", roomId).order("created_at", { ascending: false }),
    supabase.from("chat_messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true }),
    supabase.from("design_memories").select("*").eq("scope_id", roomId).order("created_at", { ascending: false }),
    supabase.from("ai_runs").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(12)
  ]);

  const errors = [photos, analyses, moodBoards, products, renders, revisions, chatMessages, memories, aiRuns]
    .map((result) => result.error)
    .filter(Boolean);

  if (errors[0]) throw new Error(errors[0].message);

  // Proposals are loaded via the tolerant helper so a room still renders before
  // migration 009 is applied (returns [] when the table is absent).
  const actionProposals = await listProposals(roomId, supabase).catch(() => [] as ActionProposal[]);
  const generationJobs = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(100)
    .then((result) => (result.error ? [] : ((result.data ?? []) as GenerationJob[])));
  const implementationPackages = await supabase
    .from("implementation_packages")
    .select("*")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .then((result) => (result.error ? [] : ((result.data ?? []) as ImplementationPackage[])));

  return {
    room: roomWithHome,
    home: roomWithHome.homes,
    photos: (photos.data ?? []) as Photo[],
    diagnoses: (analyses.data ?? []) as Diagnosis[],
    moodBoards: (moodBoards.data ?? []) as MoodBoard[],
    products: (products.data ?? []) as Product[],
    renders: (renders.data ?? []) as Render[],
    revisions: (revisions.data ?? []) as Revision[],
    chatMessages: (chatMessages.data ?? []) as ChatMessage[],
    actionProposals,
    memories: (memories.data ?? []) as Memory[],
    aiRuns: (aiRuns.data ?? []) as AiRun[],
    generationJobs,
    implementationPackages
  };
}
