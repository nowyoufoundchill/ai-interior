"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { GenerationJob, Photo, Render, Room } from "@/types/database";

type Props = { room: Room; photos: Photo[]; renders: Render[]; generationJobs: GenerationJob[] };
const ACTIVE = new Set(["queued", "planning", "validating", "generating", "persisting"]);

export function AutopilotRoomWorkspace({ room, photos, renders, generationJobs }: Props) {
  const router = useRouter();
  const source = photos.find((photo) => photo.label === "Main angle") ?? photos[0];
  const current = renders.find((render) => render.status === "candidate" || render.status === "accepted");
  const designJobs = generationJobs.filter((job) => job.job_type === "render" && isAutopilotDesignJob(job));
  const activeJob = designJobs.find((job) => ACTIVE.has(job.status));
  const latestJob = designJobs[0];
  const failedJob = latestJob && ["retryable_failed", "terminal_failed"].includes(latestJob.status) ? latestJob : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"before" | "after">("after");
  const [revisionText, setRevisionText] = useState("");
  const busyRef = useRef(false);
  const revisionRequestId = useRef<string | null>(null);

  useEffect(() => {
    if (!activeJob) return;
    const refreshJob = () => {
      void fetch(`/api/rooms/${room.id}/jobs/${activeJob.id}`).finally(() => router.refresh());
    };
    refreshJob();
    const timer = window.setInterval(refreshJob, 2500);
    return () => window.clearInterval(timer);
  }, [activeJob, room.id, router]);

  useEffect(() => {
    setView("after");
  }, [current?.id]);

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

  async function reviseDesign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    revisionRequestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/rooms/${room.id}/visual-revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: revisionText, request_id: revisionRequestId.current })
      });
      if (!response.ok) {
        setError((await response.json().catch(() => ({}))).error ?? "We couldn't start that revision.");
      } else {
        revisionRequestId.current = null;
        setRevisionText("");
        router.refresh();
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
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
      {current ? (
        <form className="atelier-card grid gap-3 p-5" onSubmit={reviseDesign}>
          <div>
            <label htmlFor="visual-revision" className="font-serif text-xl text-atelier-ink">What would you change?</label>
            <p className="mt-1 text-sm text-atelier-umber">One clear change to this design — for example, make it warmer, add closed storage, or use less furniture.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="visual-revision"
              data-testid="visual-revision-input"
              className="atelier-field flex-1"
              value={revisionText}
              onChange={(event) => setRevisionText(event.target.value)}
              placeholder="Make the room warmer and use less furniture."
              disabled={busy || Boolean(activeJob)}
              maxLength={600}
            />
            <button
              data-testid="visual-revision-submit"
              type="submit"
              className="atelier-btn-line shrink-0"
              disabled={busy || Boolean(activeJob) || !revisionText.trim()}
            >
              {isVisualRevision(activeJob) ? "Updating this design" : "Update this design"}
            </button>
          </div>
          {current.user_regeneration_instructions ? (
            <p className="text-xs text-atelier-umber">Latest change: {current.user_regeneration_instructions}</p>
          ) : null}
        </form>
      ) : null}
      <section className="flex flex-col items-start gap-4 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="text-sm text-atelier-umber">
          {activeJob
            ? isVisualRevision(activeJob)
              ? "Updating this design. Your request will continue if you leave the page."
              : "Designing your room. This will continue if you leave the page."
            : failedJob
              ? failedJob.error_message
              : current
                ? isAccepted
                  ? "This is the design you chose to keep."
                  : "See how this direction feels in your room."
                : "Your photo and outcome are ready."}
          {error ? <p role="alert" className="mt-2 text-atelier-clay">{error}</p> : null}
        </div>
        {current && !isAccepted ? <button className="atelier-btn shrink-0" onClick={acceptDesign} disabled={busy}>Keep this design</button> : !current && source && !activeJob ? <button className="atelier-btn shrink-0" onClick={startDesign} disabled={busy}>{busy ? "Starting your design" : failedJob ? "Try again" : "Design my room"}</button> : null}
      </section>
    </main>
  );
}

function isAutopilotDesignJob(job: GenerationJob) {
  const payload = job.request_payload as Record<string, unknown>;
  return payload?.operation === "first_design" || payload?.operation === "visual_revision";
}

function isVisualRevision(job: GenerationJob | null | undefined) {
  if (!job) return false;
  const payload = job.request_payload as Record<string, unknown>;
  return payload?.operation === "visual_revision";
}

function readFinishedReview(critique: Render["critique"] | undefined) {
  if (!critique || typeof critique !== "object" || Array.isArray(critique)) return null;
  const review = (critique as Record<string, unknown>).finished_image_review;
  return review && typeof review === "object" && !Array.isArray(review) ? review : null;
}
