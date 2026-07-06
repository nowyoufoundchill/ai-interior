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
type Analysis = Database["public"]["Tables"]["room_analyses"]["Row"];
type MoodBoard = Database["public"]["Tables"]["mood_boards"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type Render = Database["public"]["Tables"]["renders"]["Row"];
type Revision = Database["public"]["Tables"]["revisions"]["Row"];
type Memory = Database["public"]["Tables"]["design_memories"]["Row"];
type AiRun = Database["public"]["Tables"]["ai_runs"]["Row"];
type TabName = (typeof ROOM_TABS)[number];

export function RoomWorkspace(props: {
  room: Room;
  home: Home;
  photos: Photo[];
  analyses: Analysis[];
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
  const latestAnalysis = props.analyses[0];

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
            <p className="mt-2">What&apos;s next: {nextHint(props.room.current_stage || props.room.status, props.photos.length, Boolean(latestAnalysis), Boolean(lockedMoodBoard))}</p>
            <p className="mt-2">Saved photos: {props.photos.length}</p>
            <p className="mt-2">
              Debug runs: {props.aiRuns.length}{" "}
              <Link href="/debug" className="font-semibold text-atelier-ink underline underline-offset-4">
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
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition ${
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
            <InfoBlock title="Dimensions" value={formatDimensions(props.room.dimensions)} />
            <InfoBlock title="Brief" value={props.room.design_brief || "No design brief saved yet."} />
          </div>
          <PhotoUploader roomId={props.room.id} photos={props.photos} />
        </section>
      )}

      {activeTab === "Diagnosis" && (
        <DiagnosisPanel
          analysis={latestAnalysis}
          isLoading={loadingAction === "analyze"}
          canGenerate={props.photos.length > 0}
          onGenerate={() => runAction("analyze", `/api/rooms/${props.room.id}/analyze`)}
        />
      )}

      {activeTab === "Concepts" && (
        <ConceptPanel
          moodBoards={props.moodBoards}
          hasAnalysis={Boolean(latestAnalysis)}
          loadingAction={loadingAction}
          onGenerate={() => runAction("moodboards", `/api/rooms/${props.room.id}/generate-moodboards`)}
          onLock={(id) => runAction("select", `/api/rooms/${props.room.id}/select-moodboard`, { mood_board_id: id })}
        />
      )}

      {activeTab === "Products" && (
        <ProductsPanel
          products={props.products}
          hasLockedConcept={Boolean(lockedMoodBoard)}
          isLoading={loadingAction === "products"}
          onGenerate={() => runAction("products", `/api/rooms/${props.room.id}/source-products`)}
        />
      )}

      {activeTab === "Renders" && (
        <RendersPanel
          renders={props.renders}
          photos={props.photos}
          hasLockedConcept={Boolean(lockedMoodBoard)}
          isLoading={loadingAction === "render"}
          onGenerate={(photoId) => runAction("render", `/api/rooms/${props.room.id}/generate-render`, { source_photo_id: photoId })}
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
  analysis?: Analysis;
  isLoading: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
}) {
  const analysis = asRecord(props.analysis?.analysis);

  return (
    <section className="grid gap-5">
      <PanelHeader
        eyebrow="Designer diagnosis"
        title="Professional room readout"
        actionLabel={props.isLoading ? "Generating" : "Generate diagnosis"}
        disabled={!props.canGenerate || props.isLoading}
        icon={ClipboardList}
        onAction={props.onGenerate}
      />
      {!props.canGenerate ? (
        <EmptyState text="Upload room photos to begin your designer diagnosis." />
      ) : !props.analysis ? (
        <EmptyState text="Generate the first room diagnosis after photos and dimensions have been added." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <InfoBlock title="Room Summary" value={String(analysis.room_summary ?? "")} />
          <InfoBlock title="Recommended Strategy" value={String(analysis.recommended_strategy ?? "")} />
          <ListBlock title="Opportunities" items={toStringArray(analysis.opportunities)} />
          <ListBlock title="Design Risks" items={toStringArray(analysis.design_risks)} />
          <ListBlock title="Constraints" items={toStringArray(analysis.constraints)} />
          <ListBlock title="Uncertainties" items={toStringArray(analysis.uncertainties)} />
        </div>
      )}
    </section>
  );
}

function ConceptPanel(props: {
  moodBoards: MoodBoard[];
  hasAnalysis: boolean;
  loadingAction: string | null;
  onGenerate: () => void;
  onLock: (id: string) => void;
}) {
  return (
    <section className="grid gap-5">
      <PanelHeader
        eyebrow="Concept directions"
        title="Three distinct concept directions"
        actionLabel={props.loadingAction === "moodboards" ? "Generating" : "Generate concepts"}
        disabled={!props.hasAnalysis || props.loadingAction === "moodboards"}
        icon={Palette}
        onAction={props.onGenerate}
      />
      {!props.hasAnalysis ? (
        <EmptyState text="Generate three design directions after the room has been analyzed." />
      ) : props.moodBoards.length === 0 ? (
        <EmptyState text="No concepts have been generated yet." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {props.moodBoards.map((board) => {
            const concept = asRecord(board.concept_data);
            const palette = Array.isArray(concept.palette) ? concept.palette : [];
            return (
              <article key={board.id} className="atelier-card grid gap-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="atelier-label">Version {board.version ?? "n/a"}</p>
                    <h3 className="mt-2 font-serif text-2xl">{board.concept_name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-atelier-linen px-3 py-1 text-xs font-semibold text-atelier-charcoal">
                      {board.status}
                    </span>
                    {board.status === "locked" && <Check className="h-5 w-5 text-atelier-moss" />}
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
                <button
                  type="button"
                  onClick={() => props.onLock(board.id)}
                  disabled={board.status === "locked"}
                  className="rounded-md border border-atelier-ink px-4 py-2 text-sm font-semibold text-atelier-ink transition hover:bg-atelier-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {board.status === "locked" ? "Locked concept" : "Lock this concept"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProductsPanel(props: {
  products: Product[];
  hasLockedConcept: boolean;
  isLoading: boolean;
  onGenerate: () => void;
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
        disabled={!props.hasLockedConcept || props.isLoading}
        icon={Package}
        onAction={props.onGenerate}
      />
      {!props.hasLockedConcept ? (
        <EmptyState text="Lock a concept before sourcing products." />
      ) : props.products.length === 0 ? (
        <EmptyState text="Generate a curated product plan for the locked direction." />
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-col gap-3 rounded-md border border-atelier-taupe/20 bg-white/60 p-3 md:flex-row md:items-end">
            <label className="grid gap-2">
              <span className="atelier-label">Category</span>
              <select className="atelier-field min-w-44" value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="atelier-label">Retailer</span>
              <select className="atelier-field min-w-44" value={retailer} onChange={(event) => setRetailer(event.target.value)}>
                {retailers.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="atelier-label">Max price</span>
              <input className="atelier-field w-36" type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="No cap" />
            </label>
            <label className="grid gap-2">
              <span className="atelier-label">Dimensions</span>
              <input className="atelier-field w-40" value={dimensionText} onChange={(event) => setDimensionText(event.target.value)} placeholder="width, note" />
            </label>
            <label className="grid gap-2">
              <span className="atelier-label">Risk</span>
              <input className="atelier-field w-40" value={riskText} onChange={(event) => setRiskText(event.target.value)} placeholder="lead time" />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const scores = asRecord(product.scores);
              return (
                <article key={product.id} className="atelier-card overflow-hidden">
                  {product.image_url && <img src={product.image_url} alt="" className="aspect-[4/3] w-full object-cover" />}
                  <div className="grid gap-3 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="atelier-label">{product.category}</p>
                      <span className="rounded-md bg-atelier-linen px-3 py-1 text-xs font-semibold text-atelier-charcoal">
                        {product.status}
                      </span>
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
                      <a href={product.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-atelier-ink underline underline-offset-4">
                        Open product source
                      </a>
                    )}
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
  isLoading: boolean;
  onGenerate: (photoId?: string) => void;
}) {
  const [sourcePhotoId, setSourcePhotoId] = useState(props.photos[0]?.id ?? "");

  return (
    <section className="grid gap-5">
      <PanelHeader
        eyebrow="Mockup studio"
        title="Render prompts and saved mockups"
        actionLabel={props.isLoading ? "Preparing" : "Generate render"}
        disabled={!props.hasLockedConcept || props.photos.length === 0 || props.isLoading}
        icon={Wand2}
        onAction={() => props.onGenerate(sourcePhotoId || undefined)}
      />
      {!props.hasLockedConcept ? (
        <EmptyState text="Lock the active concept before generating a render." />
      ) : props.photos.length === 0 ? (
        <EmptyState text="Select a source photo before generating a mockup." />
      ) : (
        <div className="grid gap-4">
          <label className="grid max-w-xl gap-2">
            <span className="atelier-label">Source photo</span>
            <select className="atelier-field" value={sourcePhotoId} onChange={(event) => setSourcePhotoId(event.target.value)}>
              {props.photos.map((photo) => (
                <option key={photo.id} value={photo.id}>
                  {photo.label ?? "Room photo"}
                </option>
              ))}
            </select>
          </label>
          {props.renders.length === 0 ? (
            <EmptyState text="Generate a render for the locked concept." />
          ) : (
            <div className="grid gap-4">
              {props.renders.map((render) => (
                <article key={render.id} className="atelier-card overflow-hidden">
                  {render.file_url && <img src={render.file_url} alt="Generated room render" className="aspect-[4/3] w-full object-cover" />}
                  <div className="grid gap-3 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="atelier-label">Version {render.mood_board_version ?? "n/a"}</p>
                      <span className="rounded-md bg-atelier-linen px-3 py-1 text-xs font-semibold text-atelier-charcoal">
                        {render.status}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-atelier-charcoal">{render.render_prompt ?? render.prompt}</p>
                  </div>
                </article>
              ))}
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
          className="atelier-field"
          rows={4}
          value={props.message}
          onChange={(event) => props.onMessageChange(event.target.value)}
          placeholder="Make it moodier, find a cheaper rug, keep my leather chair, or regenerate with darker walls."
        />
        <button
          type="button"
          onClick={props.onSend}
          disabled={props.isLoading}
          className="flex w-fit items-center gap-2 rounded-md bg-atelier-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-atelier-charcoal disabled:opacity-60"
        >
          {props.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          Save chat turn
        </button>
      </div>
      {props.revisions.length === 0 ? (
        <EmptyState text="The room chat will explain stored rationale and save confirmed revision requests." />
      ) : (
        <div className="grid gap-4">
          {props.revisions.map((revision) => (
            <article key={revision.id} className="atelier-card grid gap-3 p-5">
              <p className="atelier-label">{revision.revision_type.replaceAll("_", " ")}</p>
              <p className="font-semibold text-atelier-ink">{revision.user_message}</p>
              <p className="text-sm leading-6 text-atelier-charcoal">{revision.assistant_response}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PanelHeader(props: {
  eyebrow: string;
  title: string;
  actionLabel?: string;
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
          onClick={props.onAction}
          disabled={props.disabled}
          className="flex w-fit items-center gap-2 rounded-md bg-atelier-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-atelier-charcoal disabled:cursor-not-allowed disabled:opacity-50"
        >
          {props.actionLabel.endsWith("ing") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          {props.actionLabel}
        </button>
      )}
    </div>
  );
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <article className="atelier-card p-5">
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
