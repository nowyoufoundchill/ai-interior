"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { GenerationJob, Photo, Render, Room } from "@/types/database";

type Props = { room: Room; photos: Photo[]; renders: Render[]; generationJobs: GenerationJob[] };
const ACTIVE = new Set(["queued", "planning", "validating", "generating", "persisting"]);

export function AutopilotRoomWorkspace({ room, photos, renders, generationJobs }: Props) {
  const router = useRouter();
  const source = photos.find((photo) => photo.label === "Main angle") ?? photos[0];
  const current = renders.find((render) => render.status === "candidate" || render.status === "accepted");
  const firstDesignJobs = generationJobs.filter((job) => job.job_type === "render" && isFirstDesign(job));
  const activeJob = firstDesignJobs.find((job) => ACTIVE.has(job.status));
  const failedJob = firstDesignJobs.find((job) => ["retryable_failed", "terminal_failed"].includes(job.status));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"before" | "after">("after");

  useEffect(() => {
    if (!activeJob) return;
    const refreshJob = () => {
      void fetch(`/api/rooms/${room.id}/jobs/${activeJob.id}`).finally(() => router.refresh());
    };
    refreshJob();
    const timer = window.setInterval(refreshJob, 2500);
    return () => window.clearInterval(timer);
  }, [activeJob, room.id, router]);

  async function startDesign() {
    if (!source) return;
    setBusy(true); setError(null);
    const response = await fetch(`/api/rooms/${room.id}/first-design`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_photo_id: source.id }) });
    if (!response.ok) setError((await response.json().catch(() => ({}))).error ?? "We couldn't start your room design.");
    else router.refresh();
    setBusy(false);
  }

  async function acceptDesign() {
    if (!current) return;
    setBusy(true); setError(null);
    const response = await fetch(`/api/rooms/${room.id}/designs/${current.id}/accept`, { method: "POST" });
    if (!response.ok) setError((await response.json().catch(() => ({}))).error ?? "We couldn't keep this design.");
    else router.refresh();
    setBusy(false);
  }

  const image = current && view === "after" ? current.file_url ?? source?.file_url : source?.file_url;
  const isAccepted = current?.status === "accepted";
  const review = readFinishedReview(current?.critique);
  return (
    <main className="mx-auto grid max-w-6xl gap-6">
      <header className="flex items-end justify-between gap-4 border-b border-hairline pb-5">
        <div><p className="atelier-eyebrow">{room.name}</p><h1 className="mt-2 font-serif text-4xl text-atelier-ink">Your <em>room</em></h1></div>
        <p className="max-w-sm text-right text-sm text-atelier-umber">{current ? (isAccepted ? "Your design is saved." : "Your recommendation is ready.") : "One recommendation, composed around your photo."}</p>
      </header>
      {image ? (
        <figure className="atelier-card overflow-hidden">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={image}
              alt={current && view === "after" ? `Recommended design for ${room.name}` : `Source photo for ${room.name}`}
              fill
              priority
              sizes="(max-width: 1280px) 100vw, 1152px"
              className="object-cover"
            />
          </div>
          <figcaption className="flex items-center justify-between gap-4 border-t border-hairline px-4 py-3 text-sm text-atelier-umber">
            <span>
              {current && view === "after" ? "Recommended design" : "Your room photo"}
              {review ? " · Reviewed against your source" : ""}
            </span>
            {current && source ? (
              <span className="flex rounded-full border border-hairline p-1" aria-label="Compare before and after">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 ${view === "before" ? "bg-atelier-ink text-white" : ""}`}
                  aria-pressed={view === "before"}
                  onClick={() => setView("before")}
                >
                  Before
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 ${view === "after" ? "bg-atelier-ink text-white" : ""}`}
                  aria-pressed={view === "after"}
                  onClick={() => setView("after")}
                >
                  After
                </button>
              </span>
            ) : null}
          </figcaption>
        </figure>
      ) : (
        <div className="atelier-empty">Add one clear room photo to begin.</div>
      )}
      <section className="flex flex-col items-start gap-4 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="text-sm text-atelier-umber">
          {activeJob ? "Designing your room. This will continue if you leave the page." : failedJob ? failedJob.error_message : current ? (isAccepted ? "This is the design you chose to keep." : "See how this direction feels in your room.") : "Your photo and outcome are ready."}
          {error ? <p role="alert" className="mt-2 text-atelier-clay">{error}</p> : null}
        </div>
        {current && !isAccepted ? <button className="atelier-btn shrink-0" onClick={acceptDesign} disabled={busy}>Keep this design</button> : !current && source && !activeJob ? <button className="atelier-btn shrink-0" onClick={startDesign} disabled={busy}>{busy ? "Starting your design" : failedJob ? "Try again" : "Design my room"}</button> : null}
      </section>
    </main>
  );
}

function isFirstDesign(job: GenerationJob) {
  const payload = job.request_payload as Record<string, unknown>;
  return payload?.operation === "first_design";
}

function readFinishedReview(critique: Render["critique"] | undefined) {
  if (!critique || typeof critique !== "object" || Array.isArray(critique)) return null;
  const review = (critique as Record<string, unknown>).finished_image_review;
  return review && typeof review === "object" && !Array.isArray(review) ? review : null;
}
