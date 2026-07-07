import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

type PromptMetadata = {
  version: string;
  model?: string;
  date?: string;
  notes?: string;
};

export type VersionedPrompt = PromptMetadata & {
  body: string;
  absolutePath: string;
};

const PROMPT_FILE_URLS: Record<string, URL> = {
  "prompts/diagnosis/room-diagnosis.v1.md": new URL("../../prompts/diagnosis/room-diagnosis.v1.md", import.meta.url),
  "prompts/diagnosis/room-diagnosis.v2.md": new URL("../../prompts/diagnosis/room-diagnosis.v2.md", import.meta.url),
  "prompts/concepts/generate-room-concepts.v1.md": new URL("../../prompts/concepts/generate-room-concepts.v1.md", import.meta.url),
  "prompts/concepts/generate-room-concepts.v2.md": new URL("../../prompts/concepts/generate-room-concepts.v2.md", import.meta.url),
  "prompts/concepts/generate-room-concept.v1.md": new URL("../../prompts/concepts/generate-room-concept.v1.md", import.meta.url),
  "prompts/products/source-product-plan.v1.md": new URL("../../prompts/products/source-product-plan.v1.md", import.meta.url),
  "prompts/renders/compose-render-plan.v1.md": new URL("../../prompts/renders/compose-render-plan.v1.md", import.meta.url),
  "prompts/chat/design-chat.v1.md": new URL("../../prompts/chat/design-chat.v1.md", import.meta.url),
  "prompts/critic/score-artifact.v1.md": new URL("../../prompts/critic/score-artifact.v1.md", import.meta.url),
  "prompts/critic/score-diagnosis.v1.md": new URL("../../prompts/critic/score-diagnosis.v1.md", import.meta.url)
};

export async function loadPrompt(relativePath: string): Promise<VersionedPrompt> {
  const absolutePath = await resolvePromptPath(relativePath);
  const file = await readFile(absolutePath, "utf8");
  const match = file.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!match) {
    throw new Error(`Prompt file ${relativePath} is missing frontmatter.`);
  }

  const metadata = parseFrontmatter(match[1]);

  if (!metadata.version) {
    throw new Error(`Prompt file ${relativePath} is missing a version field.`);
  }

  return {
    ...metadata,
    body: match[2].trim(),
    absolutePath
  };
}

function parseFrontmatter(frontmatter: string): PromptMetadata {
  const metadata: PromptMetadata = { version: "" };

  for (const rawLine of frontmatter.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === "version") metadata.version = value;
    if (key === "model") metadata.model = value;
    if (key === "date") metadata.date = value;
    if (key === "notes") metadata.notes = value;
  }

  return metadata;
}

async function resolvePromptPath(relativePath: string) {
  const workspacePath = path.resolve(process.cwd(), relativePath);

  try {
    await readFile(workspacePath, "utf8");
    return workspacePath;
  } catch {
    const bundledUrl = PROMPT_FILE_URLS[relativePath];
    if (bundledUrl) {
      return fileURLToPath(bundledUrl);
    }
  }

  return workspacePath;
}
