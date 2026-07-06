import { readFile } from "node:fs/promises";
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

export async function loadPrompt(relativePath: string): Promise<VersionedPrompt> {
  const absolutePath = path.join(process.cwd(), relativePath);
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
