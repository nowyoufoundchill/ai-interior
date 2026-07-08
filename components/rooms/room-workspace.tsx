"use client";

import Link from "next/link";
import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, ClipboardList, Loader2, MessageSquare, Package, Palette, Wand2 } from "lucide-react";
import { ROOM_STATUSES, ROOM_TABS } from "@/lib/constants";
import type { Database, Json, Photo } from "@/types/database";
import { PhotoUploader } from "@/components/rooms/photo-uploader";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Home = Database["public"]["Tables"]["homes"]["Row"];
type Diagnosis = Database["public"]["Tables"]["room_analyses"]["Row"];
type MoodBoard = Database["public"]["Tables"]["mood_boards"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type Render = Database["public"]["Tables"]["renders"]["Row"];
type Revision = Database["public"]["Tables"]["revisions"]["Row"];
type Memory = Database["public"]["Tables"]["design_memories"]["Row"];
type AiRun = Database["public"]["Tables"]["ai_runs"]["Row"];
type TabName = (typeof ROOM_TABS)[number];

const TAB_TESTID: Record<TabName, string> = {
  "Photos & Brief": "photos-brief",
  Diagnosis: "diagnosis",
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
  memories: Memory[];
  aiRuns: AiRun[];
}) {
  const [activeTab, setActiveTab] = useState<TabName>("Photos & Brief");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const router = useRouter();

  const lockedMoodBoard = props.moodBoards.find((board) => board.status === "locked") ?? props.moodBoards.find((board) => board.selected);
  const latestDiagnosis = props.diagnoses[0];
  const activeConcepts = props.moodBoards.filter((board) => board.status !== "stale");
  // A diagnosis rerun marks every prior concept stale. If concepts exist but
  // none are active, the concept set is stale relative to the current diagnosis.
  const conceptsStale = props.moodBoards.length > 0 && activeConcepts.length === 0;
  const productsStale = props.products.length > 0 && props.products.every((product) => product.status === "stale");
  const rendersStale = props.renders.length > 0 && props.renders.every((render) => render.status === "stale");

  async function runAction(label: string, url: string, body?: Record<string, unknown>) {
    setLoadingAction(label);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        alert(payload.error ?? "The request failed.");
        return;
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "The request failed.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function sendChat() {
    if (!chatMessage.trim()) return;
    await runAction("chat", `/api/rooms/${props.room.id}/chat`, { message: chatMessage });
    setChatMessage("");
  }

  return (
    <div className="grid gap-7">
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <p className="atelier-label">{props.home.name}</p>
          <h1 className="mt-2 font-serif text-4xl text-atelier-ink">{props.room.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-atelier-charcoal">
            {props.room.design_brief || "Add a fuller design brief to sharpen the diagnosis, concepts, products, renders, and chat guidance."}
          </p>
        </div>
        <div className="atelier-card grid gap-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="atelier-label">Stage</span>
            <span className="rounded-md bg-atelier-linen px-3 py-1 text-xs font-semibold text-atelier-charcoal">
              {statusLabel(props.room.current_stage || props.room.status)}
            </span>
          </div>
          <div className="text-sm text-atelier-charcoal">
            <p>
              Locked concept:{" "}
              <span className="font-semibold text-atelier-ink">{lockedMoodBoard?.concept_name ?? "None yet"}</span>
            </p>
            <p className="mt-2">What&apos;s next: {nextHint(props.room.current_stage || props.room.status, props.photos.length, Boolean(latestDiagnosis), Boolean(lockedMoodBoard))}</p>
            <p className="mt-2">Saved photos: {props.photos.length}</p>
            <p className="mt-2">
              Debug runs: {props.aiRuns.length}{" "}
              <Link data-testid="debug-link" href="/debug" className="font-semibold text-atelier-ink underline underline-offset-4">
                Open debug
              </Link>
            </p>
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto border-b border-atelier-taupe/20 pb-2">
        {ROOM_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            data-testid={`tab-${TAB_TESTID[tab]}`}
            onClick={() => setActiveTab(tab)}
            className={`inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab ? "bg-atelier-ink text-white" : "bg-white/60 text-atelier-charcoal hover:bg-atelier-linen"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Photos & Brief" && (
        <section className="grid gap-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoBlock testId="room-dimensions-info" title="Dimensions" value={formatDimensions(props.room.dimensions)} />
            <InfoBlock testId="room-brief-info" title="Brief" value={props.room.design_brief || "No design brief saved yet."} />
          </div>
          <PhotoUploader roomId={props.room.id} photos={props.photos} />
        </section>
      )}

      {activeTab === "Diagnosis" && (
        <DiagnosisPanel
          diagnosis={latestDiagnosis}
          isLoading={loadingAction === "analyze"}
          canGenerate={props.photos.length > 0}
          onGenerate={() => runAction("analyze", `/api/rooms/${props.room.id}/analyze`)}
        />
      )}

      {activeTab === "Concepts" && (
        <ConceptPanel
          moodBoards={props.moodBoards}
          hasDiagnosis={Boolean(latestDiagnosis)}
          conceptsStale={conceptsStale}
          loadingAction={loadingAction}
          onGenerate={() => runAction("moodboards", `/api/rooms/${props.room.id}/generate-moodboards`)}
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
          hasLockedConcept={Boolean(lockedMoodBoard)}
          isStale={rendersStale}
          isLoading={loadingAction === "render"}
          onGenerate={(photoId, instructions) => runAction("render", `/api/rooms/${props.room.id}/generate-render`, { source_photo_id: photoId, instructions })}
        />
      )}

      {activeTab === "Chat" && (
        <ChatPanel
          revisions={props.revisions}
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
    <section className="grid gap-5">
      <PanelHeader
        eyebrow="Designer diagnosis"
        title="Professional room readout"
        actionLabel={props.isLoading ? "Generating" : "Generate diagnosis"}
        actionTestId="diagnosis-generate-button"
        disabled={!props.canGenerate || props.isLoading}
        icon={ClipboardList}
        onAction={props.onGenerate}
      />
      {!props.canGenerate ? (
        <EmptyState text="Upload room photos to begin your designer diagnosis." />
      ) : !props.diagnosis ? (
        <EmptyState text="Generate the first room diagnosis after photos and dimensions have been added." />
      ) : (
        <div data-testid={`diagnosis-panel-${props.diagnosis.version ?? props.diagnosis.id}`} className="grid gap-4">
          <div className="flex items-center gap-3 text-sm text-atelier-charcoal">
            <span className="atelier-label">Diagnosis v{props.diagnosis.version ?? 1}</span>
            <StatusBadge status={props.diagnosis.status} />
            <span className="text-xs text-atelier-charcoal/70">
              Regenerating the diagnosis marks existing concepts stale.
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
          <InfoBlock title="Room Summary" value={String(diagnosis.room_summary ?? "")} />
          <InfoBlock title="Recommended Strategy" value={String(diagnosis.recommended_strategy ?? "")} />
          <ListBlock title="Opportunities" items={toStringArray(diagnosis.opportunities)} />
          <ListBlock title="Design Risks" items={toStringArray(diagnosis.design_risks)} />
          <ListBlock title="Constraints" items={toStringArray(diagnosis.constraints)} />
          <ListBlock title="Uncertainties" items={toStringArray(diagnosis.uncertainties)} />
          </div>
        </div>
      )}
    </section>
  );
}

function ConceptPanel(props: {
  moodBoards: MoodBoard[];
  hasDiagnosis: boolean;
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
    <section className="grid gap-5">
      <PanelHeader
        eyebrow="Concept directions"
        title="Three distinct concept directions"
        actionLabel={props.loadingAction === "moodboards" ? "Generating" : props.moodBoards.length ? "Regenerate concepts" : "Generate concepts"}
        actionTestId="concepts-generate-button"
        disabled={!props.hasDiagnosis || props.loadingAction === "moodboards"}
        icon={Palette}
        onAction={props.onGenerate}
      />
      {props.conceptsStale && (
        <StaleNotice text="Your diagnosis changed since these concepts were generated. Regenerate concepts so directions reflect the current room diagnosis." />
      )}
      {!props.hasDiagnosis ? (
        <EmptyState text="Generate three design directions after the room diagnosis is ready." />
      ) : props.moodBoards.length === 0 ? (
        <EmptyState text="No concepts have been generated yet." />
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 lg:grid-cols-3">
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
            <details className="rounded-md border border-atelier-taupe/20 bg-white/40 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-atelier-charcoal">
                Previous versions ({staleConcepts.length})
              </summary>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
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
    <article data-testid={`concept-card-${conceptKey}`} className={`atelier-card grid gap-4 p-5 ${isStale ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="atelier-label">
            Version {board.version ?? "n/a"}
            {board.parent_version ? ` · from v${board.parent_version}` : ""}
          </p>
          <h3 className="mt-2 font-serif text-2xl">{board.concept_name}</h3>
          <p className="mt-1 text-xs text-atelier-charcoal/70">{originLabel(board.origin)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={board.status} />
          {isLocked && <Check className="h-5 w-5 text-atelier-moss" />}
        </div>
      </div>
      <p className="text-sm leading-6 text-atelier-charcoal">{String(concept.design_thesis ?? "")}</p>
      <div className="flex gap-2">
        {palette.slice(0, 5).map((item, index) => {
          const swatch = asRecord(item);
          return (
            <span
              key={`${board.id}-${index}`}
              className="h-9 w-9 rounded-full border border-atelier-taupe/20"
              style={{ backgroundColor: String(swatch.hex ?? "#f7f2ea") }}
              title={String(swatch.name ?? "Palette")}
            />
          );
        })}
      </div>
      <ListBlock title="Materials" items={toStringArray(concept.materials).slice(0, 5)} compact />
      <p className="text-sm leading-6 text-atelier-charcoal">{String(concept.why_it_works ?? "")}</p>

      {mode === "reharmonize" && (
        <div className="grid gap-2 rounded-md border border-atelier-taupe/20 bg-white/60 p-3">
          <span className="atelier-label">Re-harmonize direction</span>
          <textarea
            data-testid={`concept-reharmonize-input-${conceptKey}`}
            className="atelier-field"
            rows={3}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Optional: keep the palette but make it more formal, resolve the empty corner, add a stronger lighting layer..."
          />
          <div className="flex gap-2">
            <button
              type="button"
              data-testid={`concept-reharmonize-submit-${conceptKey}`}
              disabled={props.busy}
              onClick={() => {
                props.onReharmonize(board.id, instructions);
                setMode("none");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-atelier-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-atelier-charcoal disabled:opacity-60"
            >
              {props.busy ? "Re-harmonizing" : "Create refined version"}
            </button>
            <button
              type="button"
              data-testid={`concept-reharmonize-cancel-${conceptKey}`}
              onClick={() => setMode("none")}
              className="inline-flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-sm text-atelier-charcoal"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "edit" && (
        <div className="grid gap-2 rounded-md border border-atelier-taupe/20 bg-white/60 p-3">
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
          <p className="text-xs text-atelier-charcoal/70">Saves as a new draft version; the current version is kept in history.</p>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid={`concept-edit-submit-${conceptKey}`}
              disabled={props.busy}
              onClick={() => {
                props.onEdit(board.id, { concept_name: editName, design_thesis: editThesis });
                setMode("none");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-atelier-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-atelier-charcoal disabled:opacity-60"
            >
              {props.busy ? "Saving" : "Save as new version"}
            </button>
            <button
              type="button"
              data-testid={`concept-edit-cancel-${conceptKey}`}
              onClick={() => setMode("none")}
              className="inline-flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-sm text-atelier-charcoal"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "none" && (
        <div className="flex flex-wrap gap-2">
          {isLocked ? (
            <button
              type="button"
              data-testid={`concept-unlock-button-${conceptKey}`}
              onClick={() => props.onUnlock(board.id)}
              disabled={props.busy}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-atelier-ink px-4 py-2 text-sm font-semibold text-atelier-ink transition hover:bg-atelier-ink hover:text-white disabled:opacity-60"
            >
              {props.busy ? "Working" : "Unlock concept"}
            </button>
          ) : (
            <button
              type="button"
              data-testid={`concept-lock-button-${conceptKey}`}
              onClick={() => props.onLock(board.id)}
              disabled={props.busy}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-atelier-ink px-4 py-2 text-sm font-semibold text-atelier-ink transition hover:bg-atelier-ink hover:text-white disabled:opacity-60"
            >
              {props.busy ? "Working" : isStale ? "Re-lock this concept" : "Lock this concept"}
            </button>
          )}
          <button
            type="button"
            data-testid={`concept-reharmonize-button-${conceptKey}`}
            onClick={() => setMode("reharmonize")}
            disabled={props.busy}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-atelier-taupe/40 px-4 py-2 text-sm font-semibold text-atelier-charcoal transition hover:bg-atelier-linen disabled:opacity-60"
          >
            Re-harmonize
          </button>
          {!isStale && !isLocked && (
            <button
              type="button"
              data-testid={`concept-edit-button-${conceptKey}`}
              onClick={() => setMode("edit")}
              disabled={props.busy}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-atelier-taupe/40 px-4 py-2 text-sm font-semibold text-atelier-charcoal transition hover:bg-atelier-linen disabled:opacity-60"
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
    <section className="grid gap-5">
      <PanelHeader
        eyebrow="Product plan"
        title="Shoppable direction with rationale"
        actionLabel={props.isLoading ? "Sourcing" : "Generate products"}
        actionTestId="products-generate-button"
        disabled={!props.hasLockedConcept || props.isLoading}
        icon={Package}
        onAction={props.onGenerate}
      />
      {props.isStale && (
        <StaleNotice text="The locked concept changed, so this product plan is stale. Regenerate products to match the current locked concept." />
      )}
      {!props.hasLockedConcept ? (
        <EmptyState text="Lock a concept before sourcing products." />
      ) : props.products.length === 0 ? (
        <EmptyState text="Generate a curated product plan for the locked direction." />
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-col gap-3 rounded-md border border-atelier-taupe/20 bg-white/60 p-3 md:flex-row md:items-end">
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const scores = asRecord(product.scores);
              return (
                <article
                  key={product.id}
                  data-testid={`product-card-${product.id}`}
                  className={`atelier-card overflow-hidden ${product.status === "rejected" ? "opacity-60" : ""}`}
                >
                  {(product.cached_image_path ?? product.image_url) && (
                    <img src={product.cached_image_path ?? product.image_url ?? ""} alt="" className="aspect-[4/3] w-full object-cover" />
                  )}
                  <div className="grid gap-3 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="atelier-label">{product.category}</p>
                      <StatusBadge status={product.status} />
                    </div>
                    <h3 className="font-serif text-xl">{product.name}</h3>
                    <p className="text-sm text-atelier-charcoal">
                      {product.retailer} {product.price ? `- $${product.price}` : ""}
                    </p>
                    <p className="text-sm leading-6 text-atelier-charcoal">{product.reason_selected}</p>
                    <dl className="grid gap-2 text-xs text-atelier-charcoal">
                      <div>
                        <dt className="font-semibold text-atelier-ink">Dimensions</dt>
                        <dd>{Object.entries(asRecord(product.dimensions)).map(([key, value]) => `${key}: ${String(value)}`).join("; ") || "Confirm before purchase."}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-atelier-ink">Risks</dt>
                        <dd>{toStringArray(product.risks).join("; ") || "No risks saved."}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-atelier-ink">Alternatives</dt>
                        <dd>{toStringArray(product.alternatives).join("; ") || "No alternatives saved."}</dd>
                      </div>
                    </dl>
                    <div className="grid grid-cols-2 gap-2 text-xs text-atelier-charcoal">
                      <span>Style {String(scores.style_fit ?? "N/A")}</span>
                      <span>Scale {String(scores.scale_fit ?? "N/A")}</span>
                      <span>Budget {String(scores.budget_fit ?? "N/A")}</span>
                      <span>Luxury {String(scores.luxury_signal ?? "N/A")}</span>
                    </div>
                    {product.url && (
                      <a
                        data-testid={`product-source-link-${product.id}`}
                        href={product.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-atelier-ink underline underline-offset-4"
                      >
                        Open product source
                      </a>
                    )}
                    {(() => {
                      const busy = props.loadingAction === `product-${product.id}`;
                      return (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {product.status !== "approved" && (
                            <button
                              type="button"
                              data-testid={`product-approve-button-${product.id}`}
                              disabled={busy}
                              onClick={() => props.onSetStatus(product.id, "approve")}
                              className="inline-flex min-h-11 items-center justify-center rounded-md border border-atelier-moss px-3 py-1.5 text-xs font-semibold text-atelier-moss transition hover:bg-atelier-moss hover:text-white disabled:opacity-60"
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
                              className="inline-flex min-h-11 items-center justify-center rounded-md border border-atelier-taupe/40 px-3 py-1.5 text-xs font-semibold text-atelier-charcoal transition hover:bg-atelier-linen disabled:opacity-60"
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
                              className="inline-flex min-h-11 items-center justify-center rounded-md px-3 py-1.5 text-xs text-atelier-charcoal underline underline-offset-4 disabled:opacity-60"
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
  hasLockedConcept: boolean;
  isStale: boolean;
  isLoading: boolean;
  onGenerate: (photoId?: string, instructions?: string) => void;
}) {
  const [sourcePhotoId, setSourcePhotoId] = useState(props.photos[0]?.id ?? "");
  const [instructions, setInstructions] = useState("");

  return (
    <section className="grid gap-5">
      <PanelHeader
        eyebrow="Photo edit studio"
        title="Restyle your real room photos"
        actionLabel={props.isLoading ? "Editing" : "Edit this photo"}
        actionTestId="render-generate-button"
        disabled={!props.hasLockedConcept || props.photos.length === 0 || props.isLoading}
        icon={Wand2}
        onAction={() => props.onGenerate(sourcePhotoId || undefined, instructions || undefined)}
      />
      {props.isStale && (
        <StaleNotice text="The locked concept changed, so these photo edits are stale. Re-edit from the current locked concept and a source photo." />
      )}
      {!props.hasLockedConcept ? (
        <EmptyState text="Lock the active concept before editing a room photo." />
      ) : props.photos.length === 0 ? (
        <EmptyState text="Add a source photo before editing it." />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-3 rounded-md border border-atelier-taupe/20 bg-white/60 p-4 md:grid-cols-2">
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
          <p className="text-xs text-atelier-charcoal/70">
            Every edit preserves the room architecture, camera angle, windows, doors, and floor plane, and applies only the locked concept plus your instructions.
          </p>
          {props.renders.length === 0 ? (
            <EmptyState text="Edit a source photo to see a before/after for the locked concept." />
          ) : (
            <div className="grid gap-4">
              {props.renders.map((render) => {
                const sourcePhoto = props.photos.find((photo) => photo.id === render.source_photo_id);
                const critique = asRecord(render.critique);
                return (
                  <article key={render.id} data-testid={`render-card-${render.id}`} className="atelier-card overflow-hidden">
                    <div className="grid gap-1 md:grid-cols-2">
                      <figure className="grid gap-1">
                        <figcaption className="atelier-label px-4 pt-4">Before</figcaption>
                        {sourcePhoto?.file_url ? (
                          <img src={sourcePhoto.file_url} alt="Source room photo" className="aspect-[4/3] w-full object-cover" />
                        ) : (
                          <div className="flex aspect-[4/3] items-center justify-center bg-atelier-linen text-xs text-atelier-charcoal">Source photo unavailable</div>
                        )}
                      </figure>
                      <figure className="grid gap-1">
                        <figcaption className="atelier-label px-4 pt-4">After</figcaption>
                        {render.file_url ? (
                          <img src={render.file_url} alt="Edited room photo" className="aspect-[4/3] w-full object-cover" />
                        ) : (
                          <div className="flex aspect-[4/3] items-center justify-center bg-atelier-linen text-xs text-atelier-charcoal">Image pending — edit plan saved</div>
                        )}
                      </figure>
                    </div>
                    <div className="grid gap-3 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="atelier-label">Concept v{render.mood_board_version ?? "n/a"}</p>
                        <StatusBadge status={render.status} />
                      </div>
                      <p className="text-sm leading-6 text-atelier-charcoal">{render.render_prompt ?? render.prompt}</p>
                      {render.user_regeneration_instructions && (
                        <p className="text-sm text-atelier-charcoal">
                          <span className="font-semibold text-atelier-ink">Your instructions:</span> {render.user_regeneration_instructions}
                        </p>
                      )}
                      <details className="text-sm text-atelier-charcoal">
                        <summary className="cursor-pointer font-semibold text-atelier-ink">Preservation &amp; edit details</summary>
                        <div className="mt-3 grid gap-3">
                          <ListBlock title="Preserved" items={toStringArray(render.preservation_constraints)} compact />
                          <ListBlock title="Applied changes" items={toStringArray(render.transformation_instructions)} compact />
                          <ListBlock title="Avoided" items={toStringArray(render.negative_instructions)} compact />
                          <ListBlock title="Critic notes" items={toStringArray(critique.notes)} compact />
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
  revisions: Revision[];
  message: string;
  isLoading: boolean;
  onMessageChange: (message: string) => void;
  onSend: () => void;
}) {
  return (
    <section className="grid gap-5">
      <PanelHeader eyebrow="Design chat" title="Explain decisions and propose reruns" icon={MessageSquare} />
      <div className="atelier-card grid gap-3 p-5">
        <textarea
          data-testid="chat-message-input"
          className="atelier-field"
          rows={4}
          value={props.message}
          onChange={(event) => props.onMessageChange(event.target.value)}
          placeholder="Make it moodier, find a cheaper rug, keep my leather chair, or regenerate with darker walls."
        />
        <button
          type="button"
          data-testid="chat-send-button"
          onClick={props.onSend}
          disabled={props.isLoading}
          className="flex min-h-11 w-fit items-center gap-2 rounded-md bg-atelier-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-atelier-charcoal disabled:opacity-60"
        >
          {props.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          Save chat turn
        </button>
      </div>
      {props.revisions.length === 0 ? (
        <EmptyState text="The room chat explains stored rationale and proposes next steps. It never changes your design on its own — you confirm reruns and preferences yourself." />
      ) : (
        <div className="grid gap-4">
          {props.revisions.map((revision) => {
            const proposal = proposalHint(revision.revision_type);
            return (
              <article key={revision.id} data-testid={`chat-message-card-${revision.id}`} className="atelier-card grid gap-3 p-5">
                <p className="atelier-label">{revision.revision_type.replaceAll("_", " ")}</p>
                <p className="font-semibold text-atelier-ink">{revision.user_message}</p>
                <p className="text-sm leading-6 text-atelier-charcoal">{revision.assistant_response}</p>
                {proposal && (
                  <p className="rounded-md border border-atelier-taupe/30 bg-atelier-linen/60 px-3 py-2 text-xs text-atelier-charcoal">
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

function PanelHeader(props: {
  eyebrow: string;
  title: string;
  actionLabel?: string;
  actionTestId?: string;
  disabled?: boolean;
  icon: ComponentType<{ className?: string }>;
  onAction?: () => void;
}) {
  const Icon = props.icon;
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="atelier-label">{props.eyebrow}</p>
        <h2 className="mt-2 font-serif text-3xl">{props.title}</h2>
      </div>
      {props.actionLabel && props.onAction && (
        <button
          type="button"
          data-testid={props.actionTestId}
          onClick={props.onAction}
          disabled={props.disabled}
          className="flex min-h-11 w-fit items-center gap-2 rounded-md bg-atelier-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-atelier-charcoal disabled:cursor-not-allowed disabled:opacity-50"
        >
          {props.actionLabel.endsWith("ing") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          {props.actionLabel}
        </button>
      )}
    </div>
  );
}

function InfoBlock({ title, value, testId }: { title: string; value: string; testId?: string }) {
  return (
    <article data-testid={testId} className="atelier-card p-5">
      <p className="atelier-label">{title}</p>
      <p className="mt-3 text-sm leading-6 text-atelier-charcoal">{value}</p>
    </article>
  );
}

function ListBlock({ title, items, compact = false }: { title: string; items: string[]; compact?: boolean }) {
  return (
    <article className={compact ? "" : "atelier-card p-5"}>
      <p className="atelier-label">{title}</p>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-atelier-charcoal">
        {(items.length ? items : ["No details saved yet."]).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "locked"
      ? "bg-atelier-moss/15 text-atelier-moss"
      : status === "stale"
        ? "bg-amber-100 text-amber-800"
        : status === "rejected"
          ? "bg-rose-100 text-rose-700"
          : status === "approved"
            ? "bg-atelier-moss/15 text-atelier-moss"
            : "bg-atelier-linen text-atelier-charcoal";
  return <span className={`rounded-md px-3 py-1 text-xs font-semibold capitalize ${tone}`}>{status}</span>;
}

function StaleNotice({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{text}</div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-atelier-taupe/40 bg-white/50 p-8 text-center text-sm text-atelier-charcoal">
      {text}
    </div>
  );
}

function statusLabel(status: string) {
  return ROOM_STATUSES[status as keyof typeof ROOM_STATUSES] ?? status.replaceAll("_", " ");
}

function nextHint(stage: string, photoCount: number, hasDiagnosis: boolean, hasLockedConcept: boolean) {
  if (!photoCount) return "Add photos, dimensions, and a design brief.";
  if (!hasDiagnosis || stage === "empty" || stage === "photos") return "Run the room diagnosis.";
  if (!hasLockedConcept || stage === "diagnosed" || stage === "concepts") return "Generate and lock a concept.";
  return "Generate products, renders, or use chat to request a revision.";
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
