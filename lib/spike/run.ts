import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { generateImageEdit, type GatewayProvider } from "@/lib/ai/gateway";
import { moodBoardGenerator, productSourcingAgent, renderPromptDirector, roomVisionAnalyst } from "@/lib/ai/services";
import { extractTavily, isTavilyConfigured, searchTavily } from "@/lib/ai/tavily";

const jsonScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const jsonValue: z.ZodType<unknown> = z.lazy(() => z.union([jsonScalar, z.array(jsonValue), z.record(z.string(), jsonValue)]));

const spikePhotoSchema = z.object({
  url: z.string().url(),
  label: z.string().trim().optional(),
  angle_type: z.string().trim().optional(),
  ai_caption: z.string().trim().optional()
});

export const spikeInputSchema = z.object({
  home: z.object({
    name: z.string().trim().min(1),
    region: z.string().trim().optional(),
    home_type: z.string().trim().optional(),
    style_notes: z.string().trim().optional()
  }),
  room: z.object({
    name: z.string().trim().min(1),
    room_type: z.string().trim().optional(),
    purpose: z.string().trim().optional(),
    budget_range: z.string().trim().optional(),
    design_brief: z.string().trim().min(1),
    dimensions: z.record(z.string(), jsonValue).default({})
  }),
  photos: z.array(spikePhotoSchema).min(1),
  source_photo_url: z.string().url().optional(),
  notes: z.string().trim().optional()
});

export type SpikeInput = z.infer<typeof spikeInputSchema>;

export async function runSpike(input: SpikeInput) {
  const startedAt = new Date().toISOString();
  const roomId = `spike-${crypto.randomUUID()}`;
  const sourcePhoto = input.photos.find((photo) => photo.url === input.source_photo_url) ?? input.photos[0];
  const provider: GatewayProvider = "anthropic";

  const room = {
    id: roomId,
    name: input.room.name,
    room_type: input.room.room_type ?? null,
    purpose: input.room.purpose ?? null,
    budget_range: input.room.budget_range ?? null,
    style_preferences: [],
    color_preferences: [],
    constraints: [],
    existing_items: [],
    design_brief: input.room.design_brief,
    dimensions: input.room.dimensions
  };

  const home = {
    id: `spike-home-${crypto.randomUUID()}`,
    name: input.home.name,
    region: input.home.region ?? null,
    home_type: input.home.home_type ?? null,
    style_notes: input.home.style_notes ?? null
  };

  const diagnosis = await roomVisionAnalyst({
    room,
    home,
    photoCount: input.photos.length,
    photos: input.photos.map((photo, index) => ({
      id: `spike-photo-${index + 1}`,
      file_url: photo.url,
      label: photo.label ?? null,
      angle_type: photo.angle_type ?? null,
      ai_caption: photo.ai_caption ?? null
    })),
    provider
  });

  const concepts = await moodBoardGenerator({
    room,
    home,
    analysis: diagnosis,
    provider
  });

  const lockedConcept = {
    id: `spike-mood-board-${crypto.randomUUID()}`,
    concept_name: concepts[0]?.concept_name ?? "Spike concept",
    concept_data: concepts[0] ?? {},
    quality_score: concepts[0]?.quality_score ?? null,
    version: 1
  };

  const products = await productSourcingAgent({
    room,
    home,
    analysis: diagnosis,
    selectedMoodBoard: lockedConcept,
    provider
  });

  const tavily = isTavilyConfigured()
    ? await runTavilyResearch(products, room.name)
    : {
        available: false,
        searches: [],
        extracts: [],
        note: "TAVILY_API_KEY is not configured, so Tavily enrichment was skipped."
      };

  const renderPlan = await renderPromptDirector({
    roomId,
    sourcePhotoId: sourcePhoto.url,
    moodBoardId: lockedConcept.id,
    room,
    analysis: diagnosis,
    selectedMoodBoard: lockedConcept,
    sourcePhoto: {
      id: sourcePhoto.url,
      file_url: sourcePhoto.url,
      label: sourcePhoto.label ?? null,
      angle_type: sourcePhoto.angle_type ?? null,
      ai_caption: sourcePhoto.ai_caption ?? null
    },
    provider
  });

  const imageBase64 = await generateImageEdit({
    roomId,
    serviceName: "Spike Render Image Generator",
    promptVersion: "render_image_v1",
    prompt: renderPlan.render_prompt,
    sourceImageUrl: sourcePhoto.url
  });

  const output = {
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    providers: {
      reasoning: provider,
      image_edit: imageBase64 ? "openai" : "mock",
      tavily: tavily.available ? "tavily" : "unavailable"
    },
    input,
    diagnosis,
    concepts,
    locked_concept: lockedConcept,
    products,
    tavily,
    render_plan: renderPlan,
    image_edit: {
      generated: Boolean(imageBase64),
      source_photo_url: sourcePhoto.url
    }
  };

  const artifactPath = await saveSpikeArtifact(output, input.room.name);

  return {
    ...output,
    artifact_path: artifactPath
  };
}

async function runTavilyResearch(
  products: Array<{
    name: string;
    retailer?: string | null;
    category: string;
  }>,
  roomName: string
) {
  const searchTargets = products.slice(0, 3).map((product) => ({
    label: `${product.category}: ${product.name}`,
    query: `${product.name} ${product.retailer ?? ""} ${roomName}`.trim()
  }));

  const searches = await Promise.all(
    searchTargets.map(async (target) => {
      const response = await searchTavily({
        query: target.query,
        maxResults: 3,
        includeRawContent: false,
        includeImages: true
      });

      return {
        label: target.label,
        query: target.query,
        answer: response.answer ?? null,
        images: response.images ?? [],
        results:
          response.results?.map((result) => ({
            title: result.title ?? null,
            url: result.url ?? null,
            score: result.score ?? null,
            content: result.content ?? null,
            images: result.images ?? []
          })) ?? [],
        usage: response.usage ?? null
      };
    })
  );

  const extractUrls = searches.flatMap((search) => search.results.map((result) => result.url).filter((url): url is string => Boolean(url))).slice(0, 3);
  const extractResponse = extractUrls.length
    ? await extractTavily({
        urls: extractUrls,
        query: "Find price, dimensions, material, and availability cues for this interior design product."
      })
    : null;

  return {
    available: true,
    searches,
    extracts: extractResponse?.results ?? [],
    usage: {
      search_credits: searches.reduce((total, search) => total + Number(search.usage?.credits ?? 0), 0),
      extract_credits: Number(extractResponse?.usage?.credits ?? 0)
    }
  };
}

async function saveSpikeArtifact(payload: unknown, roomName: string) {
  const slug = roomName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const relativePath = path.join("spike", "runs", `${timestamp}-${slug || "room"}.json`);
  const absolutePath = path.join(process.cwd(), relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, JSON.stringify(payload, null, 2), "utf8");

  return relativePath.replaceAll("\\", "/");
}
