"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ROOM_STATUSES, ROOM_TABS } from "@/lib/constants";
import type { Database, Json, Photo } from "@/types/database";
import { PhotoUploader } from "@/components/rooms/photo-uploader";
import { observeJob } from "@/components/jobs/job-observer";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Home = Database["public"]["Tables"]["homes"]["Row"];
type Diagnosis = Database["public"]["Tables"]["room_analyses"]["Row"];
type MoodBoard = Database["public"]["Tables"]["mood_boards"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type Render = Database["public"]["Tables"]["renders"]["Row"];
type Revision = Database["public"]["Tables"]["revisions"]["Row"];
type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];
type Memory = Database["public"]["Tables"]["design_memories"]["Row"];
type TabName = (typeof ROOM_TABS)[number];
type OutputAction = "analyze" | "moodboards" | "products" | "render" | "chat";
type FlowStepId = "intake" | "concept" | "render" | "refine";

type PendingOutput = {
  action: OutputAction;
  phase: "request" | "refresh";
  targetTab: TabName;
  startedAt: number;
  baseline: {
    diagnosisId?: string;
    moodBoardCount: number;
    productCount: number;
    renderId?: string;
    renderCount: number;
    chatCount: number;
  };
};

const TAB_TESTID: Record<TabName, string> = {
  "Photos & Brief": "photos-brief",
  Concepts: "concepts",
  Products: "products",
  Renders: "renders",
  Chat: "chat"
};

export function RoomWorkspace(props: {
  room: Room;
  home: Home;
  photos: Photo[];
  diagnoses: Diagnosis[];
  moodBoards: MoodBoard[];
  products: Product[];
  renders: Render[];
  revisions: Revision[];
  chatMessages: ChatMessage[];
  memories: Memory[];
}) {
  const lockedMoodBoard = props.moodBoards.find((board) => board.status === "locked") ?? props.moodBoards.find((board) => board.selected);
  const latestDiagnosis = props.diagnoses[0];
  const hasCurrentDiagnosis = latestDiagnosis?.status === "current";
  const currentRender = props.renders.find((render) => render.status !== "stale") ?? props.renders[0];

  // Land on the owner's most valuable artifact, not the intake screen: a
  // finished room opens on its render, not on photo upload.
  const initialTab: TabName = props.renders.length
    ? "Renders"
    : lockedMoodBoard
      ? "Renders"
      : props.moodBoards.length
        ? "Concepts"
        : "Photos & Brief";

  const [activeTab, setActiveTab] = useState<TabName>(initialTab);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [pendingOutput, setPendingOutput] = useState<PendingOutput | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [chatMessage, setChatMessage] = useState("");
  const router = useRouter();

  const activeConcepts = props.moodBoards.filter((board) => board.status !== "stale");
  // A diagnosis rerun marks every prior concept stale. If concepts exist but
  // none are active, the concept set is stale relative to the current diagnosis.
  const conceptsStale = props.moodBoards.length > 0 && activeConcepts.length === 0;
  const productsStale = props.products.length > 0 && props.products.every((product) => product.status === "stale");
  const rendersStale = props.renders.length > 0 && props.renders.every((render) => render.status === "stale");

  useEffect(() => {
    if (!pendingOutput) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - pendingOutput.startedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [pendingOutput]);

  useEffect(() => {
    if (!pendingOutput) return;

    const outputArrived =
      pendingOutput.action === "analyze"
        ? Boolean(latestDiagnosis?.id && latestDiagnosis.id !== pendingOutput.baseline.diagnosisId)
        : pendingOutput.action === "moodboards"
          ? props.moodBoards.length > pendingOutput.baseline.moodBoardCount
          : pendingOutput.action === "products"
            ? props.products.length > pendingOutput.baseline.productCount
            : pendingOutput.action === "render"
              ? Boolean(currentRender?.id && (currentRender.id !== pendingOutput.baseline.renderId || props.renders.length > pendingOutput.baseline.renderCount))
              : props.chatMessages.length >= pendingOutput.baseline.chatCount + 2;

    if (outputArrived) {
      setLoadingAction(null);
      setPendingOutput(null);
      setElapsedSeconds(0);
    }
  }, [currentRender?.id, latestDiagnosis?.id, pendingOutput, props.chatMessages.length, props.moodBoards.length, props.products.length, props.renders.length]);

  async function runAction(label: string, url: string, body?: Record<string, unknown>) {
    const outputAction = getOutputAction(label);
    const targetTab = outputAction ? outputTargetTab(outputAction) : null;
    if (targetTab) setActiveTab(targetTab);
    setLoadingAction(label);
    if (outputAction && targetTab) {
      setElapsedSeconds(0);
      setPendingOutput({
        action: outputAction,
        phase: "request",
        targetTab,
        startedAt: Date.now(),
        baseline: {
          diagnosisId: latestDiagnosis?.id,
          moodBoardCount: props.moodBoards.length,
          productCount: props.products.length,
          renderId: currentRender?.id,
          renderCount: props.renders.length,
          chatCount: props.chatMessages.length
        }
      });
    }

    let keepWaitingForOutput = false;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        alert(payload.error ?? "The request failed.");
        return false;
      }

      keepWaitingForOutput = Boolean(outputAction);
      if (outputAction && targetTab) {
        setActiveTab(targetTab);
        setPendingOutput((current) => current && current.action === outputAction ? { ...current, phase: "refresh" } : current);
      }
      router.refresh();
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : "The request failed.");
      return false;
    } finally {
      if (!keepWaitingForOutput) {
        setLoadingAction(null);
        setPendingOutput(null);
        setElapsedSeconds(0);
      }
    }
  }

  // Diagnosis via the durable generation-job path (P0.1): the job keeps running
  // and completes even if this tab is closed; the observer polls status and
  // refreshes when the artifact lands. Falls back to the synchronous route if
  // the jobs table isn't migrated yet.
  async function runDurableDiagnosis() {
    setLoadingAction("analyze");
    setElapsedSeconds(0);
    setPendingOutput({
      action: "analyze",
      phase: "request",
      targetTab: "Photos & Brief",
      startedAt: Date.now(),
      baseline: {
        diagnosisId: latestDiagnosis?.id,
        moodBoardCount: props.moodBoards.length,
        productCount: props.products.length,
        renderId: currentRender?.id,
        renderCount: props.renders.length,
        chatCount: props.chatMessages.length
      }
    });

    try {
      const response = await fetch(`/api/rooms/${props.room.id}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_type: "diagnosis" })
      });

      if (response.status === 503) {
        // Jobs table not migrated yet — use the synchronous compatibility route.
        setLoadingAction(null);
        setPendingOutput(null);
        return runAction("analyze", `/api/rooms/${props.room.id}/analyze`);
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        alert(payload.error ?? "The diagnosis request failed.");
        setLoadingAction(null);
        setPendingOutput(null);
        return false;
      }

      const { job } = await response.json();
      setPendingOutput((current) => (current ? { ...current, phase: "refresh" } : current));

      const settled = await observeJob(props.room.id, job.id);
      if (settled?.status === "completed") {
        router.refresh();
        return true;
      }

      alert(settled?.error_message ?? "The room reading didn't finish. You can try again.");
      setLoadingAction(null);
      setPendingOutput(null);
      setElapsedSeconds(0);
      return false;
    } catch (error) {
      alert(error instanceof Error ? error.message : "The diagnosis request failed.");
      setLoadingAction(null);
      setPendingOutput(null);
      setElapsedSeconds(0);
      return false;
    }
  }

  async function generateConceptPackage() {
    if (hasCurrentDiagnosis) {
      await runAction("moodboards", `/api/rooms/${props.room.id}/generate-moodboards`);
      return;
    }

    setActiveTab("Concepts");
    setLoadingAction("concept-package");
    setElapsedSeconds(0);
    setPendingOutput({
      action: "moodboards",
      phase: "request",
      targetTab: "Concepts",
      startedAt: Date.now(),
      baseline: {
        diagnosisId: latestDiagnosis?.id,
        moodBoardCount: props.moodBoards.length,
        productCount: props.products.length,
        renderId: currentRender?.id,
        renderCount: props.renders.length,
        chatCount: props.chatMessages.length
      }
    });

    try {
      const diagnosisResponse = await fetch(`/api/rooms/${props.room.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!diagnosisResponse.ok) {
        const payload = await diagnosisResponse.json().catch(() => ({}));
        alert(payload.error ?? "The diagnosis request failed.");
        setLoadingAction(null);
        setPendingOutput(null);
        return;
      }

      setPendingOutput((current) => current ? { ...current, phase: "refresh" } : current);

      const conceptsResponse = await fetch(`/api/rooms/${props.room.id}/generate-moodboards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!conceptsResponse.ok) {
        const payload = await conceptsResponse.json().catch(() => ({}));
        alert(payload.error ?? "The concept request failed.");
        setLoadingAction(null);
        setPendingOutput(null);
        return;
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "The request failed.");
      setLoadingAction(null);
      setPendingOutput(null);
    }
  }

  async function sendChat() {
    if (!chatMessage.trim()) return;
    const sent = await runAction("chat", `/api/rooms/${props.room.id}/chat`, { message: chatMessage });
    if (sent) setChatMessage("");
  }

  return (
    <div className="atelier-rise grid gap-12">
      <section className="grid gap-10 border-b border-hairline pb-10 lg:grid-cols-[1.4fr_0.8fr] lg:gap-16">
        <div>
          <p className="atelier-eyebrow">{props.home.name}</p>
          <h1 className="mt-3 font-serif text-5xl leading-tight text-atelier-ink">{props.room.name}</h1>
          <p className="mt-5 max-w-3xl text-sm font-light leading-7 text-atelier-umber">
            {props.room.design_brief || "Add a fuller design brief to sharpen the diagnosis, concepts, products, renders, and chat guidance."}
          </p>
        </div>
        {/* The dusk card: the room's standing sits on a charcoal ground. */}
        <div className="grid gap-4 self-start border border-hairline bg-atelier-charcoal p-7">
          <div className="flex items-baseline justify-between gap-3 border-b border-hairline-light pb-3">
            <span className="atelier-eyebrow">Stage</span>
            <span className="text-[10px] font-medium uppercase tracking-label text-atelier-ivory/70">
              {statusLabel(props.room.current_stage || props.room.status)}
            </span>
          </div>
          <div className="text-sm font-light leading-7 text-atelier-ivory/60">
            <p>
              Approved direction —{" "}
              <span className="font-serif italic text-atelier-ivory">{lockedMoodBoard?.concept_name ?? "not chosen yet"}</span>
            </p>
            <p className="mt-2">{nextHint(props.photos.length, props.moodBoards.length > 0, Boolean(lockedMoodBoard), props.renders.length > 0)}</p>
            <p className="mt-2">Saved photos — {props.photos.length}</p>
          </div>
        </div>
      </section>

      <PathGuide
        activeStep={currentFlowStep(props.photos.length, activeConcepts.length, Boolean(lockedMoodBoard), props.renders.length)}
        photoCount={props.photos.length}
        hasDiagnosis={hasCurrentDiagnosis}
        hasConcepts={activeConcepts.length > 0}
        hasApproved={Boolean(lockedMoodBoard)}
        hasRenders={props.renders.length > 0}
      />

      <div className="grid grid-cols-2 gap-x-6 border-b border-hairline sm:flex sm:gap-8 sm:overflow-x-auto">
        {ROOM_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            data-testid={`tab-${TAB_TESTID[tab]}`}
            onClick={() => setActiveTab(tab)}
            className={`-mb-px inline-flex min-h-11 min-w-11 items-center justify-start whitespace-nowrap border-b pb-3 pt-1 font-sans text-xs font-medium uppercase tracking-eyebrow transition-colors duration-300 sm:justify-center ${
              activeTab === tab
                ? "border-atelier-brass text-atelier-ink"
                : "border-transparent text-atelier-fawn hover:text-atelier-ink"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {pendingOutput && (
        <WorkInProgressNotice pending={pendingOutput} elapsedSeconds={elapsedSeconds} />
      )}

      {activeTab === "Photos & Brief" && (
        <section className="grid gap-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <InfoBlock testId="room-dimensions-info" title="Dimensions" value={formatDimensions(props.room.dimensions)} />
            <InfoBlock testId="room-brief-info" title="Brief" value={props.room.design_brief || "No design brief saved yet."} />
          </div>
          <PhotoUploader roomId={props.room.id} photos={props.photos} />
          <DiagnosisPanel
            diagnosis={latestDiagnosis}
            isLoading={loadingAction === "analyze"}
            canGenerate={props.photos.length > 0}
            onGenerate={runDurableDiagnosis}
          />
        </section>
      )}

      {activeTab === "Concepts" && (
        <ConceptPanel
          moodBoards={props.moodBoards}
          hasDiagnosis={hasCurrentDiagnosis}
          canGenerate={props.photos.length > 0}
          conceptsStale={conceptsStale}
          loadingAction={loadingAction}
          onGenerate={generateConceptPackage}
          onLock={(id) => runAction("select", `/api/rooms/${props.room.id}/select-moodboard`, { mood_board_id: id })}
          onUnlock={(id) => runAction(`concept-${id}`, `/api/rooms/${props.room.id}/moodboards/${id}`, { action: "unlock" })}
          onReharmonize={(id, instructions) =>
            runAction(`concept-${id}`, `/api/rooms/${props.room.id}/moodboards/${id}`, { action: "reharmonize", instructions })
          }
          onEdit={(id, updates) =>
            runAction(`concept-${id}`, `/api/rooms/${props.room.id}/moodboards/${id}`, { action: "edit", updates })
          }
        />
      )}

      {activeTab === "Products" && (
        <ProductsPanel
          products={props.products}
          hasLockedConcept={Boolean(lockedMoodBoard)}
          hasRender={Boolean(currentRender)}
          isStale={productsStale}
          isLoading={loadingAction === "products"}
          loadingAction={loadingAction}
          onGenerate={() => runAction("products", `/api/rooms/${props.room.id}/source-products`)}
          onSetStatus={(productId, action) =>
            runAction(`product-${productId}`, `/api/rooms/${props.room.id}/products/${productId}`, { action })
          }
        />
      )}

      {activeTab === "Renders" && (
        <RendersPanel
          renders={props.renders}
          photos={props.photos}
          conceptName={lockedMoodBoard?.concept_name ?? undefined}
          hasLockedConcept={Boolean(lockedMoodBoard)}
          isStale={rendersStale}
          isLoading={loadingAction === "render"}
          onGenerate={(photoId, instructions) => runAction("render", `/api/rooms/${props.room.id}/generate-render`, { source_photo_id: photoId, instructions })}
        />
      )}

      {activeTab === "Chat" && (
        <ChatPanel
          messages={props.chatMessages}
          revisions={props.revisions}
          conceptName={lockedMoodBoard?.concept_name ?? undefined}
          hasRender={Boolean(currentRender)}
          latestRenderInstructions={currentRender?.user_regeneration_instructions ?? undefined}
          message={chatMessage}
          isLoading={loadingAction === "chat"}
          onMessageChange={setChatMessage}
          onSend={sendChat}
        />
      )}
    </div>
  );
}

function DiagnosisPanel(props: {
  diagnosis?: Diagnosis;
  isLoading: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
}) {
  const diagnosis = asRecord(props.diagnosis?.analysis);

  return (
    <section className="grid gap-8">
      <PanelHeader
        eyebrow="The diagnosis"
        title={
          <>
            The room, <em className="italic">read</em> closely
          </>
        }
        actionLabel={props.isLoading ? "Reading the room" : "Generate diagnosis"}
        actionTestId="diagnosis-generate-button"
        disabled={!props.canGenerate || props.isLoading}
        onAction={props.onGenerate}
      />
      {!props.canGenerate ? (
        <EmptyState text="Photographs first. The diagnosis follows." />
      ) : !props.diagnosis ? (
        <EmptyState text="Generate the first reading once photos and dimensions are in." />
      ) : (
        <div data-testid={`diagnosis-panel-${props.diagnosis.version ?? props.diagnosis.id}`} className="grid gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="atelier-label">Diagnosis v{props.diagnosis.version ?? 1}</span>
            <StatusBadge status={props.diagnosis.status} />
            <span className="text-xs font-light text-atelier-fawn">
              Regenerating the diagnosis marks existing concepts stale.
            </span>
          </div>
          <div className="grid gap-8 lg:grid-cols-2">
            <InfoBlock title="Room summary" value={String(diagnosis.room_summary ?? "")} />
            <InfoBlock title="Recommended strategy" value={String(diagnosis.recommended_strategy ?? "")} />
            <ListBlock title="Opportunities" items={toStringArray(diagnosis.opportunities)} />
            <ListBlock title="Design risks" items={toStringArray(diagnosis.design_risks)} />
            <ListBlock title="Constraints" items={toStringArray(diagnosis.constraints)} />
            <ListBlock title="Uncertainties" items={toStringArray(diagnosis.uncertainties)} />
          </div>
        </div>
      )}
    </section>
  );
}

function PathGuide(props: {
  activeStep: FlowStepId;
  photoCount: number;
  hasDiagnosis: boolean;
  hasConcepts: boolean;
  hasApproved: boolean;
  hasRenders: boolean;
}) {
  const steps: { id: FlowStepId; label: string; detail: string; done: boolean }[] = [
    {
      id: "intake",
      label: "Room read",
      detail: props.hasDiagnosis
        ? "Brief, photos, dimensions, and diagnosis are together."
        : props.photoCount
          ? "Generate the room diagnosis from this page."
          : "Add photos to complete the room read.",
      done: props.hasDiagnosis
    },
    {
      id: "concept",
      label: "Concept",
      detail: props.hasConcepts ? "Choose the mood board and palette that feel right." : "Generate the diagnosis-backed concept set.",
      done: props.hasApproved
    },
    {
      id: "render",
      label: "Apply to photos",
      detail: props.hasRenders ? "The approved direction is shown on the room." : "Render the approved concept onto a source photo.",
      done: props.hasRenders
    },
    {
      id: "refine",
      label: "Refine",
      detail: "Chat through changes or source products once the visual direction holds.",
      done: props.hasRenders
    }
  ];

  return (
    <section data-testid="room-path-guide" className="grid gap-4 border-y border-hairline py-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="atelier-eyebrow">Room path</p>
          <h2 className="mt-2 font-serif text-3xl text-atelier-ink">What happens next</h2>
        </div>
        <p className="max-w-xl text-sm font-light leading-7 text-atelier-umber">
          Diagnosis and concepts are one design-direction moment: first the room is read, then three mood boards translate that read into a direction.
        </p>
      </div>
      <ol className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const isActive = step.id === props.activeStep;
          return (
            <li
              key={step.id}
              className={`border-t pt-4 ${
                isActive ? "border-atelier-brass" : step.done ? "border-atelier-ink/30" : "border-hairline"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className={isActive ? "atelier-eyebrow text-atelier-brass" : "atelier-label"}>{step.label}</p>
                <span className="text-[10px] font-medium uppercase tracking-label text-atelier-fawn">
                  {step.done ? "Done" : `0${index + 1}`}
                </span>
              </div>
              <p className="mt-2 text-xs font-light leading-6 text-atelier-umber">{step.detail}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function WorkInProgressNotice({ pending, elapsedSeconds }: { pending: PendingOutput; elapsedSeconds: number }) {
  const label = outputLabel(pending.action);
  const phaseText =
    pending.phase === "request"
      ? "Waiting for the model response and saved output."
      : "The response returned. Placing the new output in the room.";

  return (
    <div data-testid="room-output-progress-state" aria-live="polite" className="atelier-notice grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="atelier-label">{label}</p>
        <p className="text-[10px] font-medium uppercase tracking-label text-atelier-fawn">
          {elapsedSeconds < 1 ? "Just started" : `${elapsedSeconds} sec`}
        </p>
      </div>
      <p className="text-sm font-light leading-7 text-atelier-umber">{phaseText}</p>
      <div className="h-px w-full overflow-hidden bg-hairline">
        <div className="h-px w-1/3 animate-[atelierLoad_1.8s_ease-in-out_infinite] bg-atelier-brass" />
      </div>
    </div>
  );
}

function ConceptPanel(props: {
  moodBoards: MoodBoard[];
  hasDiagnosis: boolean;
  canGenerate: boolean;
  conceptsStale: boolean;
  loadingAction: string | null;
  onGenerate: () => void;
  onLock: (id: string) => void;
  onUnlock: (id: string) => void;
  onReharmonize: (id: string, instructions: string) => void;
  onEdit: (id: string, updates: Record<string, unknown>) => void;
}) {
  const activeConcepts = props.moodBoards.filter((board) => board.status !== "stale");
  const staleConcepts = props.moodBoards.filter((board) => board.status === "stale");

  return (
    <section className="grid gap-8">
      <PanelHeader
        eyebrow="Concept directions"
        title={
          <>
            Three directions, one <em className="italic">room</em>
          </>
        }
        actionLabel={
          props.loadingAction === "concept-package" || props.loadingAction === "moodboards"
            ? "Composing directions"
            : props.moodBoards.length
              ? "Regenerate concepts"
              : props.hasDiagnosis
                ? "Generate concepts"
                : "Generate diagnosis & concepts"
        }
        actionTestId="concepts-generate-button"
        disabled={!props.canGenerate || props.loadingAction === "moodboards" || props.loadingAction === "concept-package"}
        onAction={props.onGenerate}
      />
      {props.conceptsStale && (
        <StaleNotice text="Your diagnosis changed since these concepts were generated. Regenerate concepts so directions reflect the current room diagnosis." />
      )}
      {!props.canGenerate ? (
        <EmptyState text="Add at least one room photo first. Then this creates the diagnosis-backed mood boards." />
      ) : !props.hasDiagnosis ? (
        <EmptyState text="Use Generate diagnosis & concepts to read the room and compose the first three directions in one pass." />
      ) : props.moodBoards.length === 0 ? (
        <EmptyState text="No concepts have been composed yet." />
      ) : (
        <div className="grid gap-10">
          <div className="grid gap-8 lg:grid-cols-3">
            {(activeConcepts.length ? activeConcepts : staleConcepts).map((board) => (
              <ConceptCard
                key={board.id}
                board={board}
                busy={props.loadingAction === `concept-${board.id}` || props.loadingAction === "select"}
                onLock={props.onLock}
                onUnlock={props.onUnlock}
                onReharmonize={props.onReharmonize}
                onEdit={props.onEdit}
              />
            ))}
          </div>
          {activeConcepts.length > 0 && staleConcepts.length > 0 && (
            <details className="border-t border-hairline pt-5">
              <summary className="atelier-label cursor-pointer">
                Previous versions ({staleConcepts.length})
              </summary>
              <div className="mt-6 grid gap-8 lg:grid-cols-3">
                {staleConcepts.map((board) => (
                  <ConceptCard
                    key={board.id}
                    board={board}
                    busy={props.loadingAction === `concept-${board.id}`}
                    onLock={props.onLock}
                    onUnlock={props.onUnlock}
                    onReharmonize={props.onReharmonize}
                    onEdit={props.onEdit}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function ConceptCard(props: {
  board: MoodBoard;
  busy: boolean;
  onLock: (id: string) => void;
  onUnlock: (id: string) => void;
  onReharmonize: (id: string, instructions: string) => void;
  onEdit: (id: string, updates: Record<string, unknown>) => void;
}) {
  const { board } = props;
  const concept = asRecord(board.concept_data);
  const palette = Array.isArray(concept.palette) ? concept.palette : [];
  const [mode, setMode] = useState<"none" | "reharmonize" | "edit">("none");
  const [instructions, setInstructions] = useState("");
  const [editName, setEditName] = useState(board.concept_name);
  const [editThesis, setEditThesis] = useState(String(concept.design_thesis ?? ""));

  const isLocked = board.status === "locked";
  const isStale = board.status === "stale";
  const conceptKey = board.version ?? board.id;

  return (
    <article
      data-testid={`concept-card-${conceptKey}`}
      className={`atelier-card grid gap-5 p-7 transition-[outline-color,outline-offset,transform] duration-300 hover:-translate-y-1 hover:outline hover:outline-1 hover:outline-atelier-brass/50 hover:outline-offset-4 ${
        isLocked ? "atelier-approved" : ""
      } ${isStale ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={isLocked ? "atelier-eyebrow" : "atelier-label"}>
            {isLocked ? "Approved direction" : `Version ${board.version ?? "n/a"}`}
            {!isLocked && board.parent_version ? ` · from v${board.parent_version}` : ""}
          </p>
          <h3 className="mt-2 font-serif text-2xl text-atelier-ink">{board.concept_name}</h3>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-label text-atelier-fawn">{originLabel(board.origin)}</p>
        </div>
        <StatusBadge status={board.status} />
      </div>
      <p className="text-sm font-light leading-7 text-atelier-umber">{String(concept.design_thesis ?? "")}</p>
      <PaletteStrip boardId={board.id} palette={palette} />
      <MaterialSwatches materials={toStringArray(concept.materials).slice(0, 6)} />
      <div className="border-t border-hairline pt-4">
        <p className="atelier-label">Why it works</p>
        <p className="mt-2 text-sm font-light leading-7 text-atelier-umber">{String(concept.why_it_works ?? "")}</p>
      </div>

      {mode === "reharmonize" && (
        <div className="grid gap-3 border-t border-hairline pt-4">
          <span className="atelier-label">Re-harmonize direction</span>
          <textarea
            data-testid={`concept-reharmonize-input-${conceptKey}`}
            className="atelier-field"
            rows={3}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Optional: keep the palette but make it more formal, resolve the empty corner, add a stronger lighting layer..."
          />
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              data-testid={`concept-reharmonize-submit-${conceptKey}`}
              disabled={props.busy}
              onClick={() => {
                props.onReharmonize(board.id, instructions);
                setMode("none");
              }}
              className="atelier-btn"
            >
              {props.busy ? "Re-harmonizing" : "Create refined version"}
            </button>
            <button
              type="button"
              data-testid={`concept-reharmonize-cancel-${conceptKey}`}
              onClick={() => setMode("none")}
              className="atelier-btn-quiet"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "edit" && (
        <div className="grid gap-3 border-t border-hairline pt-4">
          <span className="atelier-label">Edit concept</span>
          <input
            data-testid={`concept-edit-name-input-${conceptKey}`}
            className="atelier-field"
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            placeholder="Concept name"
          />
          <textarea
            data-testid={`concept-edit-thesis-input-${conceptKey}`}
            className="atelier-field"
            rows={3}
            value={editThesis}
            onChange={(event) => setEditThesis(event.target.value)}
            placeholder="Design thesis"
          />
          <p className="text-xs font-light text-atelier-fawn">Saves as a new draft version; the current version is kept in history.</p>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              data-testid={`concept-edit-submit-${conceptKey}`}
              disabled={props.busy}
              onClick={() => {
                props.onEdit(board.id, { concept_name: editName, design_thesis: editThesis });
                setMode("none");
              }}
              className="atelier-btn"
            >
              {props.busy ? "Saving" : "Save as new version"}
            </button>
            <button
              type="button"
              data-testid={`concept-edit-cancel-${conceptKey}`}
              onClick={() => setMode("none")}
              className="atelier-btn-quiet"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "none" && (
        <div className="flex flex-wrap items-center gap-5 border-t border-hairline pt-4">
          {isLocked ? (
            <button
              type="button"
              data-testid={`concept-unlock-button-${conceptKey}`}
              onClick={() => props.onUnlock(board.id)}
              disabled={props.busy}
              className="atelier-btn"
            >
              {props.busy ? "Working" : "Change direction"}
            </button>
          ) : (
            <button
              type="button"
              data-testid={`concept-lock-button-${conceptKey}`}
              onClick={() => props.onLock(board.id)}
              disabled={props.busy}
              className="atelier-btn"
            >
              {props.busy ? "Working" : isStale ? "Re-approve this direction" : "Approve this direction"}
            </button>
          )}
          <button
            type="button"
            data-testid={`concept-reharmonize-button-${conceptKey}`}
            onClick={() => setMode("reharmonize")}
            disabled={props.busy}
            className="atelier-btn-line"
          >
            Re-harmonize
          </button>
          {!isStale && !isLocked && (
            <button
              type="button"
              data-testid={`concept-edit-button-${conceptKey}`}
              onClick={() => setMode("edit")}
              disabled={props.busy}
              className="atelier-btn-line"
            >
              Edit
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function originLabel(origin: string) {
  switch (origin) {
    case "reharmonized":
      return "Re-harmonized direction";
    case "edited":
      return "Owner-edited direction";
    case "generated":
    default:
      return "Generated direction";
  }
}

function ProductsPanel(props: {
  products: Product[];
  hasLockedConcept: boolean;
  hasRender: boolean;
  isStale: boolean;
  isLoading: boolean;
  loadingAction: string | null;
  onGenerate: () => void;
  onSetStatus: (productId: string, action: string) => void;
}) {
  const [category, setCategory] = useState("All");
  const [maxPrice, setMaxPrice] = useState("");
  const [retailer, setRetailer] = useState("All");
  const [riskText, setRiskText] = useState("");
  const [dimensionText, setDimensionText] = useState("");
  const categories = ["All", ...Array.from(new Set(props.products.map((product) => product.category)))];
  const retailers = ["All", ...Array.from(new Set(props.products.map((product) => product.retailer).filter((item): item is string => Boolean(item))))];
  const filteredProducts = props.products.filter((product) => {
    const categoryMatch = category === "All" || product.category === category;
    const retailerMatch = retailer === "All" || product.retailer === retailer;
    const priceMatch = !maxPrice || !product.price || product.price <= Number(maxPrice);
    const riskMatch = !riskText || toStringArray(product.risks).some((risk) => risk.toLowerCase().includes(riskText.toLowerCase()));
    const dimensions = asRecord(product.dimensions);
    const dimensionMatch = !dimensionText || Object.values(dimensions).some((value) => String(value).toLowerCase().includes(dimensionText.toLowerCase()));
    return categoryMatch && retailerMatch && priceMatch && riskMatch && dimensionMatch;
  });

  return (
    <section className="grid gap-8">
      <PanelHeader
        eyebrow="The product plan"
        title={
          <>
            The pieces that make it <em className="italic">real</em>
          </>
        }
        actionLabel={props.isLoading ? "Sourcing the plan" : "Generate products"}
        actionTestId="products-generate-button"
        disabled={!props.hasLockedConcept || !props.hasRender || props.isLoading}
        onAction={props.onGenerate}
      />
      {props.isStale && (
        <StaleNotice text="The approved direction changed, so this product plan is stale. Regenerate products to match the current direction." />
      )}
      {!props.hasLockedConcept ? (
        <EmptyState text="Products follow an approved direction." />
      ) : !props.hasRender ? (
        <EmptyState text="See the direction on your real room first. The pieces come after the picture." />
      ) : props.products.length === 0 ? (
        <EmptyState text="A curated plan for the approved direction, when you are ready." />
      ) : (
        <div className="grid gap-8">
          <div className={`flex-col gap-4 border-y border-hairline py-5 md:flex-row md:items-end ${props.products.length > 8 ? "flex" : "hidden"}`}>
            <label className="grid gap-2">
              <span className="atelier-label">Category</span>
              <select
                data-testid="product-filter-category-select"
                className="atelier-field min-w-44"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="atelier-label">Retailer</span>
              <select
                data-testid="product-filter-retailer-select"
                className="atelier-field min-w-44"
                value={retailer}
                onChange={(event) => setRetailer(event.target.value)}
              >
                {retailers.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="atelier-label">Max price</span>
              <input
                data-testid="product-filter-max-price-input"
                className="atelier-field w-36"
                type="number"
                min="0"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="No cap"
              />
            </label>
            <label className="grid gap-2">
              <span className="atelier-label">Dimensions</span>
              <input
                data-testid="product-filter-dimensions-input"
                className="atelier-field w-40"
                value={dimensionText}
                onChange={(event) => setDimensionText(event.target.value)}
                placeholder="width, note"
              />
            </label>
            <label className="grid gap-2">
              <span className="atelier-label">Risk</span>
              <input
                data-testid="product-filter-risk-input"
                className="atelier-field w-40"
                value={riskText}
                onChange={(event) => setRiskText(event.target.value)}
                placeholder="lead time"
              />
            </label>
          </div>
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => {
              return (
                <article
                  key={product.id}
                  data-testid={`product-card-${product.id}`}
                  className={`atelier-card atelier-hover-img overflow-hidden ${product.status === "rejected" ? "opacity-60" : ""}`}
                >
                  <ProductImage product={product} />
                  <div className="grid gap-4 border-t border-hairline p-7">
                    <div className="flex items-center justify-between gap-3">
                      <p className="atelier-label">{product.category}</p>
                      <StatusBadge status={product.status} />
                    </div>
                    <h3 className="font-serif text-xl text-atelier-ink">{product.name}</h3>
                    <p className="text-[11px] font-medium uppercase tracking-label text-atelier-fawn">
                      {product.retailer}
                      {product.price ? ` — $${product.price}` : ""}
                    </p>
                    <p className="text-sm font-light leading-7 text-atelier-umber">{product.reason_selected}</p>
                    <dl className="grid gap-3 border-t border-hairline pt-4 text-xs font-light text-atelier-umber">
                      <div>
                        <dt className="atelier-label">Dimensions</dt>
                        <dd className="mt-1">{Object.entries(asRecord(product.dimensions)).map(([key, value]) => `${key}: ${String(value)}`).join("; ") || "Confirm before purchase."}</dd>
                      </div>
                      <div>
                        <dt className="atelier-label">Risks</dt>
                        <dd className="mt-1">{toStringArray(product.risks).join("; ") || "No risks saved."}</dd>
                      </div>
                      <div>
                        <dt className="atelier-label">Alternatives</dt>
                        <dd className="mt-1">{toStringArray(product.alternatives).join("; ") || "No alternatives saved."}</dd>
                      </div>
                    </dl>
                    {product.url?.startsWith("http") && (
                      <a
                        data-testid={`product-source-link-${product.id}`}
                        href={product.url}
                        target="_blank"
                        rel="noreferrer"
                        className="atelier-btn-line w-fit"
                      >
                        View at {product.retailer ?? "retailer"}
                      </a>
                    )}
                    {(() => {
                      const busy = props.loadingAction === `product-${product.id}`;
                      return (
                        <div className="flex flex-wrap items-center gap-5 pt-1">
                          {product.status !== "approved" && (
                            <button
                              type="button"
                              data-testid={`product-approve-button-${product.id}`}
                              disabled={busy}
                              onClick={() => props.onSetStatus(product.id, "approve")}
                              className="atelier-btn-line text-atelier-brass"
                            >
                              {busy ? "Saving" : "Approve"}
                            </button>
                          )}
                          {product.status !== "rejected" && (
                            <button
                              type="button"
                              data-testid={`product-reject-button-${product.id}`}
                              disabled={busy}
                              onClick={() => props.onSetStatus(product.id, "reject")}
                              className="atelier-btn-quiet"
                            >
                              {busy ? "Saving" : "Reject"}
                            </button>
                          )}
                          {(product.status === "approved" || product.status === "rejected") && (
                            <button
                              type="button"
                              data-testid={`product-reset-button-${product.id}`}
                              disabled={busy}
                              onClick={() => props.onSetStatus(product.id, "reset")}
                              className="atelier-btn-quiet"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function RendersPanel(props: {
  renders: Render[];
  photos: Photo[];
  conceptName?: string;
  hasLockedConcept: boolean;
  isStale: boolean;
  isLoading: boolean;
  onGenerate: (photoId?: string, instructions?: string) => void;
}) {
  const [sourcePhotoId, setSourcePhotoId] = useState(props.photos[0]?.id ?? "");
  const [instructions, setInstructions] = useState("");

  return (
    <section className="grid gap-8">
      <PanelHeader
        eyebrow="The studio"
        title={
          <>
            Your room, <em className="italic">reimagined</em>
          </>
        }
        actionLabel={props.isLoading ? "Composing the edit" : "Edit this photo"}
        actionTestId="render-generate-button"
        disabled={!props.hasLockedConcept || props.photos.length === 0 || props.isLoading}
        onAction={() => props.onGenerate(sourcePhotoId || undefined, instructions || undefined)}
      />
      {props.isStale && (
        <StaleNotice text="The approved direction changed, so these photo edits are stale. Re-edit from the current direction and a source photo." />
      )}
      {!props.hasLockedConcept ? (
        <EmptyState text="Approve a direction first. The picture follows." />
      ) : props.photos.length === 0 ? (
        <EmptyState text="Add a source photo before editing it." />
      ) : (
        <div className="grid gap-8">
          <div className="grid gap-6 border-y border-hairline py-6 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="atelier-label">Source photo</span>
              <select
                data-testid="render-source-photo-select"
                className="atelier-field"
                value={sourcePhotoId}
                onChange={(event) => setSourcePhotoId(event.target.value)}
              >
                {props.photos.map((photo) => (
                  <option key={photo.id} value={photo.id}>
                    {photo.label ?? "Room photo"}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="atelier-label">Edit instructions (optional)</span>
              <textarea
                data-testid="render-instructions-input"
                className="atelier-field"
                rows={2}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
          placeholder="Keep my leather chair, make the walls darker, add a larger rug..."
              />
            </label>
          </div>
          <p className="text-xs font-light leading-6 text-atelier-fawn">
            Every edit preserves the room architecture, camera angle, windows, doors, and floor plane, and applies only the approved direction plus your instructions.
          </p>
          {props.renders.length === 0 ? (
            <EmptyState text="One photograph, restyled in place — the before and after of the approved direction." />
          ) : (
            <div className="grid gap-10">
              {props.renders.map((render) => {
                const sourcePhoto = props.photos.find((photo) => photo.id === render.source_photo_id);
                const critique = asRecord(render.critique);
                return (
                  <article key={render.id} data-testid={`render-card-${render.id}`} className="atelier-card overflow-hidden">
                    {/* Image-first hero: the transformed room is the flagship
                        artifact, shown large; the source photo sits beneath as a
                        smaller labeled "before" reference. */}
                    <figure className="relative">
                      <figcaption className="absolute left-5 top-5 z-10 border border-hairline bg-atelier-paper/90 px-3 py-1.5 text-[10px] font-medium uppercase tracking-eyebrow text-atelier-brass">
                        After · {props.conceptName ?? "Approved direction"}
                      </figcaption>
                      {render.file_url ? (
                        <img src={render.file_url} alt="Edited room photo" className="aspect-[16/10] w-full object-cover" />
                      ) : (
                        <div className="flex aspect-[16/10] items-center justify-center bg-atelier-charcoal">
                          {/* Principle VIII — type as image for the imageless state. */}
                          <span className="font-serif text-4xl text-atelier-ivory/80">
                            A<em className="italic text-atelier-brass">i</em>D
                            <span className="ml-4 align-middle font-sans text-[10px] font-medium uppercase tracking-wide2 text-atelier-ivory/40">
                              Image pending — edit plan saved
                            </span>
                          </span>
                        </div>
                      )}
                    </figure>
                    <div className="grid gap-4 border-b border-t border-hairline px-7 py-4 sm:flex sm:items-center">
                      <figure className="grid gap-3 sm:flex sm:items-center">
                        <figcaption className="atelier-label">Before</figcaption>
                        {sourcePhoto?.file_url ? (
                          <img
                            src={sourcePhoto.file_url}
                            alt="Source room photo"
                            className="h-20 w-full border border-hairline object-cover sm:h-14 sm:w-20"
                          />
                        ) : (
                          <div className="flex h-20 w-full items-center justify-center border border-hairline bg-atelier-ivory text-[0.6rem] font-light text-atelier-fawn sm:h-14 sm:w-20">
                            No source
                          </div>
                        )}
                      </figure>
                      <p className="text-xs font-light leading-5 text-atelier-fawn">
                        Your real {sourcePhoto?.label ?? "room"} photo, restyled in place — architecture, camera, windows and doors preserved.
                      </p>
                    </div>
                    <div className="grid gap-4 p-7">
                      <div className="flex items-center justify-between gap-3">
                        <p className="atelier-eyebrow">{props.conceptName ?? "Approved direction"}</p>
                        <StatusBadge status={render.status} />
                      </div>
                      <p className="text-sm font-light leading-7 text-atelier-umber">
                        {props.conceptName ?? "Your approved direction"} applied to your {sourcePhoto?.label ?? "room"} photo, preserving the real architecture, camera angle, windows, and doors.
                      </p>
                      {render.user_regeneration_instructions && (
                        <p className="text-sm font-light leading-7 text-atelier-umber">
                          <span className="atelier-label">Your instructions — </span>
                          {render.user_regeneration_instructions}
                        </p>
                      )}
                      <details className="border-t border-hairline pt-4 text-sm text-atelier-umber">
                        <summary className="atelier-label cursor-pointer">Preservation &amp; edit details</summary>
                        <div className="mt-4 grid gap-4">
                          <ListBlock title="Preserved" items={toStringArray(render.preservation_constraints)} compact />
                          <ListBlock title="Applied changes" items={toStringArray(render.transformation_instructions)} compact />
                          <ListBlock title="Avoided" items={toStringArray(render.negative_instructions)} compact />
                          <ListBlock title="Critic notes" items={toStringArray(critique.notes)} compact />
                          {(render.render_prompt || render.prompt) && (
                            <div>
                              <p className="atelier-label">Full edit brief</p>
                              <p className="mt-2 text-xs font-light leading-6 text-atelier-fawn">{render.render_prompt ?? render.prompt}</p>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ChatPanel(props: {
  messages: ChatMessage[];
  revisions: Revision[];
  conceptName?: string;
  hasRender: boolean;
  latestRenderInstructions?: string;
  message: string;
  isLoading: boolean;
  onMessageChange: (message: string) => void;
  onSend: () => void;
}) {
  return (
    <section className="grid gap-8">
      <PanelHeader
        eyebrow="Design chat"
        title={
          <>
            Talk it <em className="italic">through</em>
          </>
        }
      />
      {/* Context chips make the conversation feel grounded in the current work,
          not a blind text box. */}
      <div className="flex flex-wrap gap-3">
        <span className="atelier-chip">Direction — {props.conceptName ?? "not chosen yet"}</span>
        <span className="atelier-chip">{props.hasRender ? "Working from your latest render" : "No render yet"}</span>
        {props.latestRenderInstructions && (
          <span className="atelier-chip">Last change — {props.latestRenderInstructions}</span>
        )}
      </div>
      {props.isLoading && (
        <div data-testid="chat-progress-state" className="atelier-notice">
          Reviewing the approved direction, latest render, and your requested change before replying.
        </div>
      )}
      <div className="grid gap-4 border-y border-hairline py-6">
        <textarea
          data-testid="chat-message-input"
          className="atelier-field"
          rows={4}
          value={props.message}
          onChange={(event) => props.onMessageChange(event.target.value)}
          placeholder="Describe the change you want to study."
        />
        <button
          type="button"
          data-testid="chat-send-button"
          onClick={props.onSend}
          disabled={props.isLoading}
          className="atelier-btn w-fit"
        >
          {props.isLoading ? "Composing a reply" : "Send"}
        </button>
      </div>
      {props.messages.length === 0 ? (
        <EmptyState text="Ask your designer anything about this room — why a choice was made, or what to change. They will talk it through and point you to the next step, but never alter your design without you." />
      ) : (
        <div className="grid gap-6">
          {props.messages.map((message) => {
            const proposal = message.role === "assistant" ? proposalHint(message.classified_intent ?? "") : null;
            return (
              <article
                key={message.id}
                data-testid={`chat-message-card-${message.id}`}
                className={`grid gap-3 border-l p-6 ${
                  message.role === "user" ? "border-hairline bg-atelier-paper" : "border-atelier-brass/60 bg-atelier-ivory"
                }`}
              >
                <p className={message.role === "assistant" ? "atelier-eyebrow" : "atelier-label"}>
                  {message.role === "assistant" ? "Designer" : "You"}
                  {message.classified_intent ? ` — ${message.classified_intent.replaceAll("_", " ")}` : ""}
                </p>
                <p className={message.role === "assistant" ? "text-sm font-light leading-7 text-atelier-umber" : "font-serif text-lg leading-relaxed text-atelier-ink"}>
                  {message.content}
                </p>
                {proposal && (
                  <p className="border-t border-hairline pt-3 text-xs font-light text-atelier-fawn">
                    Proposal only — {proposal}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function proposalHint(revisionType: string): string | null {
  switch (revisionType) {
    case "style_revision":
    case "whole_home_check":
      return "confirm by re-harmonizing or regenerating in the Concepts tab.";
    case "product_revision":
    case "budget_revision":
      return "confirm by regenerating in the Products tab.";
    case "render_revision":
    case "layout_revision":
      return "confirm by editing a photo in the Renders tab.";
    case "memory_update":
      return "add it to your home Design preferences to make it stick.";
    default:
      return null;
  }
}

function getOutputAction(label: string): OutputAction | null {
  if (label === "analyze") return "analyze";
  if (label === "moodboards") return "moodboards";
  if (label === "products") return "products";
  if (label === "render") return "render";
  if (label === "chat") return "chat";
  return null;
}

function outputTargetTab(action: OutputAction): TabName {
  switch (action) {
    case "analyze":
      return "Photos & Brief";
    case "moodboards":
      return "Concepts";
    case "products":
      return "Products";
    case "render":
      return "Renders";
    case "chat":
      return "Chat";
  }
}

function outputLabel(action: OutputAction) {
  switch (action) {
    case "analyze":
      return "Reading the room";
    case "moodboards":
      return "Composing directions";
    case "products":
      return "Sourcing the product plan";
    case "render":
      return "Composing the photo edit";
    case "chat":
      return "Writing the reply";
  }
}

function PanelHeader(props: {
  eyebrow: string;
  title: ReactNode;
  actionLabel?: string;
  actionTestId?: string;
  disabled?: boolean;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div>
        <p className="atelier-eyebrow">{props.eyebrow}</p>
        <h2 className="mt-3 font-serif text-4xl text-atelier-ink">{props.title}</h2>
      </div>
      {props.actionLabel && props.onAction && (
        <button
          type="button"
          data-testid={props.actionTestId}
          onClick={props.onAction}
          disabled={props.disabled}
          className="atelier-btn"
        >
          {props.actionLabel}
          {props.actionLabel.endsWith("ing") || props.actionLabel.includes("ing ") ? "…" : ""}
        </button>
      )}
    </div>
  );
}

function InfoBlock({ title, value, testId }: { title: string; value: string; testId?: string }) {
  return (
    <article data-testid={testId} className="border-t border-hairline pt-4">
      <p className="atelier-label">{title}</p>
      <p className="mt-3 text-sm font-light leading-7 text-atelier-umber">{value}</p>
    </article>
  );
}

function ListBlock({ title, items, compact = false }: { title: string; items: string[]; compact?: boolean }) {
  return (
    <article className={compact ? "" : "border-t border-hairline pt-4"}>
      <p className="atelier-label">{title}</p>
      <ul className="mt-3 grid gap-2 text-sm font-light leading-7 text-atelier-umber">
        {(items.length ? items : ["No details saved yet."]).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function PaletteStrip({ boardId, palette }: { boardId: string; palette: unknown[] }) {
  const swatches = palette.slice(0, 6).map((item) => asRecord(item));
  if (!swatches.length) return null;
  return (
    <div className="border-t border-hairline pt-4">
      <p className="atelier-label">Palette</p>
      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {swatches.map((swatch, index) => {
          const hex = String(swatch.hex ?? "#f5f1ea");
          const name = String(swatch.name ?? "Tone");
          return (
            <div key={`${boardId}-sw-${index}`} className="grid gap-1.5">
              <span className="atelier-swatch" style={{ backgroundColor: hex }} title={`${name} ${hex}`} />
              <span className="text-[0.68rem] font-light leading-tight text-atelier-umber">{name}</span>
              <span className="text-[0.6rem] font-medium uppercase tracking-label text-atelier-taupe">{hex}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MaterialSwatches({ materials }: { materials: string[] }) {
  if (!materials.length) return null;
  return (
    <div className="border-t border-hairline pt-4">
      <p className="atelier-label">Materials</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {materials.map((material) => (
          <span key={material} className="atelier-chip">
            {material}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProductImage({ product }: { product: Product }) {
  const src = product.cached_image_path ?? product.image_url ?? "";
  const [failed, setFailed] = useState(!src);

  // Never render a broken-image icon. A product whose image can't load (dead
  // or fabricated URL) falls back to Principle VIII: the category set as quiet
  // type on a dark ground, rather than the browser's broken-image glyph.
  if (failed || !src) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-atelier-charcoal">
        <span className="font-serif text-2xl italic text-atelier-ivory/50">{product.category}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="aspect-[4/3] w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "locked" || status === "approved"
      ? "atelier-status atelier-status-approved"
      : status === "stale" || status === "rejected"
        ? "atelier-status atelier-status-stale"
        : "atelier-status";
  // Owner-facing language: a "locked" concept reads as the approved direction;
  // a "stale" artifact reads as needing a refresh, not a database state.
  const label = status === "locked" ? "Approved" : status === "stale" ? "Needs refresh" : status;
  return <span className={tone}>{label}</span>;
}

function StaleNotice({ text }: { text: string }) {
  return <div className="atelier-notice-stale">{text}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="atelier-empty">{text}</div>;
}

function statusLabel(status: string) {
  return ROOM_STATUSES[status as keyof typeof ROOM_STATUSES] ?? status.replaceAll("_", " ");
}

function nextHint(photoCount: number, hasConcepts: boolean, hasApproved: boolean, hasRenders: boolean) {
  if (!photoCount) return "Add photos, dimensions, and a design brief.";
  if (!hasConcepts) return "Generate the diagnosis-backed concept directions.";
  if (!hasApproved) return "Approve the direction that feels right.";
  if (!hasRenders) return "See the approved direction on your real room photo.";
  return "Refine it in chat, or source the products to make it real.";
}

function currentFlowStep(photoCount: number, conceptCount: number, hasApproved: boolean, renderCount: number): FlowStepId {
  if (!photoCount) return "intake";
  if (!conceptCount || !hasApproved) return "concept";
  if (!renderCount) return "render";
  return "refine";
}

function formatDimensions(value: Json | unknown) {
  const record = asRecord(value);
  const entries = Object.entries(record);
  return entries.length ? entries.map(([key, item]) => `${key}: ${String(item)}`).join("; ") : "No dimensions saved yet.";
}

function asRecord(value: Json | unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
