import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "js-yaml";

export interface WrittenSpec {
  filePath: string;
  name: string;
}

/**
 * Write a spec object to a YAML file in the specs directory.
 * Returns the file path. Refuses to overwrite existing files unless force=true.
 */
export async function writeSpec(
  specsDir: string,
  spec: Record<string, unknown>,
  options: { force?: boolean; filename?: string } = {},
): Promise<WrittenSpec> {
  const name = (spec.name as string) ?? "untitled-spec";
  const safeName = name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  const filename = options.filename ?? `${safeName}.yaml`;
  const filePath = path.join(specsDir, filename);

  await fs.mkdir(specsDir, { recursive: true });
  const yamlContent = yaml.dump(spec, { lineWidth: 100, noRefs: true });

  try {
    // The "wx" flag fails atomically with EEXIST if the file already exists,
    // avoiding a TOCTOU race between an existence check and the write.
    await fs.writeFile(filePath, yamlContent, { flag: options.force ? "w" : "wx" });
  } catch (err: any) {
    if (err.code === "EEXIST") {
      throw new Error(`Spec file already exists: ${filePath} (use --force to overwrite)`);
    }
    throw err;
  }

  return { filePath, name };
}

/**
 * Extract YAML blocks from a string of agent output.
 * Agents often emit specs as fenced code blocks.
 */
export function extractYamlBlocks(text: string): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [];
  const fenceRegex = /```ya?ml\n([\s\S]*?)\n```/g;
  let match;
  while ((match = fenceRegex.exec(text)) !== null) {
    try {
      const parsed = yaml.load(match[1]);
      if (parsed && typeof parsed === "object") {
        blocks.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Skip invalid YAML
    }
  }

  // If no fenced blocks, try parsing the whole text as YAML
  if (blocks.length === 0) {
    try {
      const parsed = yaml.load(text);
      if (parsed && typeof parsed === "object" && "name" in parsed) {
        blocks.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Ignore
    }
  }

  return blocks;
}
