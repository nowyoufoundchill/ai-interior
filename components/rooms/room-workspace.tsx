"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, ClipboardList, Loader2, MessageSquare, Package, Palette, Sparkles, Trash2, Wand2 } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<TabName>("Photos");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const router = useRouter();

  const selectedMoodBoard = props.moodBoards.find((board) => board.selected);
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
            {props.room.design_brief || "Add a fuller design brief to sharpen the diagnosis, concepts, products, renders, and chat memory."}
          </p>
        </div>
        <div className="atelier-card grid gap-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="atelier-label">Stage</span>
            <span className="rounded-md bg-atelier-linen px-3 py-1 text-xs font-semibold text-atelier-charcoal">
              {statusLabel(props.room.status)}
            </span>
          </div>
          <div className="text-sm text-atelier-charcoal">
            <p>
              Selected concept:{" "}
              <span className="font-semibold text-atelier-ink">
                {selectedMoodBoard?.concept_name ?? "None yet"}
              </span>
            </p>
            <p className="mt-2">Saved photos: {props.photos.length}</p>
            <p className="mt-2">Debug runs: {props.aiRuns.length}</p>
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

      {activeTab === "Photos" && <PhotoUploader roomId={props.room.id} photos={props.photos} />}

      {activeTab === "Diagnosis" && (
        <DiagnosisPanel
          analysis={latestAnalysis}
          isLoading={loadingAction === "analyze"}
          canGenerate={props.photos.length > 0}
          onGenerate={() => runAction("analyze", `/api/rooms/${props.room.id}/analyze`)}
        />
      )}

      {activeTab === "Mood Boards" && (
        <MoodBoardPanel
          moodBoards={props.moodBoards}
          hasAnalysis={Boolean(latestAnalysis)}
          loadingAction={loadingAction}
          onGenerate={() => runAction("moodboards", `/api/rooms/${props.room.id}/generate-moodboards`)}
          onSelect={(id) => runAction("select", `/api/rooms/${props.room.id}/select-moodboard`, { mood_board_id: id })}
        />
      )}

      {activeTab === "Products" && (
        <ProductsPanel
          products={props.products}
          hasSelectedConcept={Boolean(selectedMoodBoard)}
          isLoading={loadingAction === "products"}
          onGenerate={() => runAction("products", `/api/rooms/${props.room.id}/source-products`)}
        />
      )}

      {activeTab === "Renders" && (
        <RendersPanel
          renders={props.renders}
          photos={props.photos}
          hasSelectedConcept={Boolean(selectedMoodBoard)}
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

      {activeTab === "Memory" && <MemoryPanel roomId={props.room.id} memories={props.memories} aiRuns={props.aiRuns} />}
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
        <EmptyState text="Generate the first room diagnosis after photos have been added." />
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

function MoodBoardPanel(props: {
  moodBoards: MoodBoard[];
  hasAnalysis: boolean;
  loadingAction: string | null;
  onGenerate: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="grid gap-5">
      <PanelHeader
        eyebrow="Concept directions"
        title="Three distinct mood boards"
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
                    <p className="atelier-label">Quality {board.quality_score ?? "N/A"}</p>
                    <h3 className="mt-2 font-serif text-2xl">{board.concept_name}</h3>
                  </div>
                  {board.selected && <Check className="h-5 w-5 text-atelier-moss" />}
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
                  onClick={() => props.onSelect(board.id)}
                  className="rounded-md border border-atelier-ink px-4 py-2 text-sm font-semibold text-atelier-ink transition hover:bg-atelier-ink hover:text-white"
                >
                  {board.selected ? "Selected" : "Select this direction"}
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
  hasSelectedConcept: boolean;
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
        disabled={!props.hasSelectedConcept || props.isLoading}
        icon={Package}
        onAction={props.onGenerate}
      />
      {!props.hasSelectedConcept ? (
        <EmptyState text="Select a mood board before sourcing products." />
      ) : props.products.length === 0 ? (
        <EmptyState text="Generate a curated product plan for the selected direction." />
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
              <input
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
                  <p className="atelier-label">{product.category}</p>
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
  hasSelectedConcept: boolean;
  isLoading: boolean;
  onGenerate: (photoId?: string) => void;
}) {
  const [sourcePhotoId, setSourcePhotoId] = useState(props.photos[0]?.id ?? "");

  return (
    <section className="grid gap-5">
      <PanelHeader
        eyebrow="Mockup studio"
        title="Render prompts and saved mockups"
        actionLabel={props.isLoading ? "Preparing" : "Generate render prompt"}
        disabled={!props.hasSelectedConcept || props.photos.length === 0 || props.isLoading}
        icon={Wand2}
        onAction={() => props.onGenerate(sourcePhotoId || undefined)}
      />
      {!props.hasSelectedConcept ? (
        <EmptyState text="Select the active mood board before generating a mockup." />
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
            <EmptyState text="Generate a render prompt now; image generation can be connected in a later phase." />
          ) : (
            <div className="grid gap-4">
              {props.renders.map((render) => (
                <article key={render.id} className="atelier-card overflow-hidden">
                  {render.file_url && <img src={render.file_url} alt="Generated room render" className="aspect-[4/3] w-full object-cover" />}
                  <div className="grid gap-3 p-5">
                    <p className="atelier-label">Quality {render.quality_score ?? "N/A"}</p>
                    <p className="text-sm leading-6 text-atelier-charcoal">{render.prompt}</p>
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
      <PanelHeader eyebrow="Room-aware chat" title="Design revision history" icon={MessageSquare} />
      <div className="atelier-card grid gap-3 p-5">
        <textarea
          className="atelier-field"
          rows={4}
          value={props.message}
          onChange={(event) => props.onMessageChange(event.target.value)}
          placeholder="Make this moodier, find a cheaper rug, keep my leather chair, or check whether this clashes with the living room."
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
        <EmptyState text="The room-aware design chat will remember the brief, selected concept, products, renders, and revisions." />
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

function MemoryPanel({ roomId, memories, aiRuns }: { roomId: string; memories: Memory[]; aiRuns: AiRun[] }) {
  const router = useRouter();
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");

  function beginEdit(memory: Memory) {
    setEditingMemoryId(memory.id);
    setDraftContent(JSON.stringify(memory.content, null, 2));
  }

  async function updateMemory(memory: Memory, content = draftContent) {
    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      alert("Memory content must be valid JSON.");
      return;
    }

    const response = await fetch(`/api/rooms/${roomId}/memories`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory_id: memory.id, content: parsedContent })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      alert(payload.error ?? "Memory update failed.");
      return;
    }

    setEditingMemoryId(null);
    router.refresh();
  }

  async function confirmMemory(memory: Memory) {
    await updateMemory(memory, JSON.stringify({ ...asRecord(memory.content), confirmed: true }));
  }

  async function deleteMemory(memory: Memory) {
    const response = await fetch(`/api/rooms/${roomId}/memories`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory_id: memory.id })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      alert(payload.error ?? "Memory delete failed.");
      return;
    }

    router.refresh();
  }

  return (
    <section className="grid gap-5">
      <PanelHeader eyebrow="Memory and debug" title="Saved decisions and AI run log" icon={Sparkles} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="atelier-card p-5">
          <h3 className="font-serif text-2xl">Design memories</h3>
          {memories.length === 0 ? (
            <p className="mt-3 text-sm text-atelier-charcoal">No room-level memories have been saved yet.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {memories.map((memory) => (
                <article key={memory.id} className="grid gap-3 rounded-md border border-atelier-taupe/20 bg-white/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="atelier-label">{memory.memory_type}</p>
                    <div className="flex gap-2">
                      <button type="button" className="rounded-md border border-atelier-taupe/30 px-3 py-2 text-xs font-semibold" onClick={() => confirmMemory(memory)}>
                        Confirm
                      </button>
                      <button type="button" className="rounded-md border border-atelier-taupe/30 px-3 py-2 text-xs font-semibold" onClick={() => beginEdit(memory)}>
                        Edit
                      </button>
                      <button type="button" className="rounded-md border border-atelier-taupe/30 p-2" onClick={() => deleteMemory(memory)} aria-label="Delete memory">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {editingMemoryId === memory.id ? (
                    <div className="grid gap-2">
                      <textarea className="atelier-field font-mono text-xs" rows={8} value={draftContent} onChange={(event) => setDraftContent(event.target.value)} />
                      <button type="button" className="w-fit rounded-md bg-atelier-ink px-4 py-2 text-sm font-semibold text-white" onClick={() => updateMemory(memory)}>
                        Save memory
                      </button>
                    </div>
                  ) : (
                    <pre className="overflow-auto rounded-md bg-atelier-linen p-3 text-xs">{JSON.stringify(memory.content, null, 2)}</pre>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
        <div className="atelier-card p-5">
          <h3 className="font-serif text-2xl">Debug runs</h3>
          {aiRuns.length === 0 ? (
            <p className="mt-3 text-sm text-atelier-charcoal">Mock AI runs will appear here after generating outputs.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {aiRuns.map((run) => (
                <div key={run.id} className="rounded-md border border-atelier-taupe/20 bg-white/70 p-3 text-xs">
                  <p className="font-semibold">{run.service_name}</p>
                  <p className="text-atelier-charcoal">{run.prompt_version} - {run.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
  return ROOM_STATUSES[status as keyof typeof ROOM_STATUSES] ?? status;
}

function asRecord(value: Json | unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
