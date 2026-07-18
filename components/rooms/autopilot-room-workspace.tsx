"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { GenerationJob, ImplementationPackage, Photo, Render, Room } from "@/types/database";
import type { ImplementationPackagePlan } from "@/lib/schemas";

type Props = { room: Room; photos: Photo[]; renders: Render[]; generationJobs: GenerationJob[]; implementationPackages: ImplementationPackage[] };
const ACTIVE = new Set(["queued", "planning", "validating", "generating", "persisting"]);

export function AutopilotRoomWorkspace({ room, photos, renders, generationJobs, implementationPackages }: Props) {
  const router = useRouter();
  const source = photos.find((photo) => photo.label === "Main angle") ?? photos[0];
  const current = renders.find((render) => render.status === "candidate" || render.status === "accepted");
  const designJobs = generationJobs.filter((job) => job.job_type === "render" && isAutopilotDesignJob(job));
  const activeJob = designJobs.find((job) => ACTIVE.has(job.status));
  const latestJob = designJobs[0];
  const failedJob = latestJob && ["retryable_failed", "terminal_failed"].includes(latestJob.status) ? latestJob : null;
  const packageJobs = generationJobs.filter((job) => job.job_type === "products" && isImplementationPackageJob(job));
  const activePackageJob = packageJobs.find((job) => ACTIVE.has(job.status));
  const failedPackageJob = packageJobs[0] && ["retryable_failed", "terminal_failed"].includes(packageJobs[0].status) ? packageJobs[0] : null;
  const currentPackage = implementationPackages.find((item) => item.status === "current" && item.accepted_render_id === current?.id);
  const packagePlan = currentPackage?.package as unknown as ImplementationPackagePlan | undefined;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"before" | "after">("after");
  const [revisionText, setRevisionText] = useState("");
  const busyRef = useRef(false);
  const revisionRequestId = useRef<string | null>(null);
  const packageRequestId = useRef<string | null>(null);

  useEffect(() => {
    const observedJob = activeJob ?? activePackageJob;
    if (!observedJob) return;
    const refreshJob = () => {
      void fetch(`/api/rooms/${room.id}/jobs/${observedJob.id}`).finally(() => router.refresh());
    };
    refreshJob();
    const timer = window.setInterval(refreshJob, 2500);
    return () => window.clearInterval(timer);
  }, [activeJob, activePackageJob, room.id, router]);

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

  async function createRoomPlan() {
    if (!current || !isAccepted || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    packageRequestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/rooms/${room.id}/implementation-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: packageRequestId.current })
      });
      if (!response.ok) setError((await response.json().catch(() => ({}))).error ?? "We couldn't start the room plan.");
      else {
        packageRequestId.current = null;
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
        <figure className="atelier-card overflow-hidden" data-testid="current-design" data-render-id={current?.id ?? "source"}>
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
            : activePackageJob
              ? "Creating your room plan. It will continue if you leave the page."
            : failedPackageJob
              ? failedPackageJob.error_message
            : failedJob
              ? failedJob.error_message
              : current
                ? isAccepted
                  ? "This is the design you chose to keep."
                  : "See how this direction feels in your room."
                : "Your photo and outcome are ready."}
          {error ? <p role="alert" className="mt-2 text-atelier-clay">{error}</p> : null}
        </div>
        {current && !isAccepted ? <button data-testid="accept-design-submit" className="atelier-btn shrink-0" onClick={acceptDesign} disabled={busy}>Keep this design</button> : isAccepted && !packagePlan && !activePackageJob ? <button data-testid="implementation-package-submit" className="atelier-btn shrink-0" onClick={createRoomPlan} disabled={busy}>{failedPackageJob ? "Try room plan again" : "Create room plan"}</button> : !current && source && !activeJob ? <button data-testid="first-design-submit" className="atelier-btn shrink-0" onClick={startDesign} disabled={busy}>{busy ? "Starting your design" : failedJob ? "Try again" : "Design my room"}</button> : null}
      </section>
      {packagePlan ? <ImplementationPackageView plan={packagePlan} version={currentPackage?.version ?? 1} /> : null}
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

function isImplementationPackageJob(job: GenerationJob) {
  const payload = job.request_payload as Record<string, unknown>;
  return payload?.operation === "implementation_package";
}

function readFinishedReview(critique: Render["critique"] | undefined) {
  if (!critique || typeof critique !== "object" || Array.isArray(critique)) return null;
  const review = (critique as Record<string, unknown>).finished_image_review;
  return review && typeof review === "object" && !Array.isArray(review) ? review : null;
}

function ImplementationPackageView({ plan, version }: { plan: ImplementationPackagePlan; version: number }) {
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: plan.budget.currency, maximumFractionDigits: 0 });
  return (
    <section className="grid gap-5 border-t border-hairline pt-7" data-testid="implementation-package" data-package-version={version}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="atelier-eyebrow">Room plan · Version {version}</p><h2 className="mt-2 font-serif text-3xl text-atelier-ink">Ready to measure, source, and place</h2></div>
        <p className="text-sm text-atelier-umber">{money.format(plan.budget.total_low)}–{money.format(plan.budget.total_high)} estimated</p>
      </div>
      <p className="max-w-3xl text-sm leading-6 text-atelier-umber">{plan.summary}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="atelier-card p-5" data-testid="field-verification-list">
          <h3 className="font-serif text-xl text-atelier-ink">Measure before buying</h3>
          <ol className="mt-4 grid gap-3 text-sm text-atelier-umber">
            {plan.field_verification_tasks.map((task) => <li key={task.id}><span className="font-medium text-atelier-ink">{task.task}</span><span className="mt-1 block">{task.reason}</span></li>)}
          </ol>
        </article>
        <article className="atelier-card p-5" data-testid="budget-summary">
          <h3 className="font-serif text-xl text-atelier-ink">Budget and assumptions</h3>
          <p className="mt-3 text-2xl text-atelier-ink">{money.format(plan.budget.total_low)}–{money.format(plan.budget.total_high)}</p>
          <p className="mt-2 text-sm text-atelier-umber">{plan.budget.variance_summary}</p>
          <ul className="mt-3 list-disc pl-5 text-sm text-atelier-umber">{plan.budget.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </div>
      <details className="atelier-card p-5" open>
        <summary className="cursor-pointer font-serif text-xl text-atelier-ink">Furnishing and material schedule</summary>
        <div className="mt-4 grid gap-3" data-testid="furnishing-schedule">
          {plan.furnishing_schedule.map((item) => (
            <article key={item.id} className="grid gap-2 border-t border-hairline pt-4 sm:grid-cols-[1fr_auto]" data-testid={`schedule-item-${item.id}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2"><h4 className="font-medium text-atelier-ink">{item.quantity} × {item.category}</h4><span className="rounded-full border border-hairline px-2 py-0.5 text-xs text-atelier-umber">{classificationLabel(item.classification)}</span></div>
                <p className="mt-1 text-sm text-atelier-umber">{item.description}</p>
                <p className="mt-2 text-xs text-atelier-umber">{item.placement.statement} · {provenanceLabel(item.placement.provenance)}</p>
                {item.product ? <a className="mt-2 inline-block text-sm underline underline-offset-4" href={item.product.canonical_url} target="_blank" rel="noreferrer">View {item.product.retailer} reference</a> : null}
              </div>
              <p className="text-sm text-atelier-umber">{money.format(item.budget_low)}–{money.format(item.budget_high)}</p>
            </article>
          ))}
        </div>
      </details>
      <details className="atelier-card p-5">
        <summary className="cursor-pointer font-serif text-xl text-atelier-ink">Placement, sequence, and caveats</summary>
        <ol className="mt-4 grid gap-3 text-sm text-atelier-umber">{[...plan.installation_sequence].sort((a, b) => a.order - b.order).map((step) => <li key={step.order}><span className="font-medium text-atelier-ink">{step.order}. {step.step}</span>{step.caveats.length ? <span className="mt-1 block">{step.caveats.join(" ")}</span> : null}</li>)}</ol>
        <ul className="mt-4 list-disc pl-5 text-sm text-atelier-umber">{plan.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
      </details>
    </section>
  );
}

function classificationLabel(value: string) {
  return value.replaceAll("_", " ");
}

function provenanceLabel(value: string) {
  return `${value.replaceAll("_", " ")} guidance`;
}
