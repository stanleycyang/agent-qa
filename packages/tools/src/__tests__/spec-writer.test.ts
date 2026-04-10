import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { writeSpec, extractYamlBlocks } from "../spec-writer.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "agentqa-specwriter-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("writeSpec", () => {
  it("creates a YAML file with spec content", async () => {
    const spec = { name: "Login Flow", environment: { type: "web" } };
    const result = await writeSpec(tmpDir, spec);
    expect(result.name).toBe("Login Flow");
    expect(result.filePath).toContain("login-flow.yaml");

    const content = await fs.readFile(result.filePath, "utf-8");
    expect(content).toContain("Login Flow");
  });

  it("refuses to overwrite existing file", async () => {
    const spec = { name: "Test" };
    await writeSpec(tmpDir, spec);
    await expect(writeSpec(tmpDir, spec)).rejects.toThrow("already exists");
  });

  it("overwrites with force=true", async () => {
    const spec = { name: "Test", version: 1 };
    await writeSpec(tmpDir, spec);
    const spec2 = { name: "Test", version: 2 };
    const result = await writeSpec(tmpDir, spec2, { force: true });
    const content = await fs.readFile(result.filePath, "utf-8");
    expect(content).toContain("version: 2");
  });

  it("sanitizes filename (lowercase, replace special chars)", async () => {
    const spec = { name: "My Special Test! #1" };
    const result = await writeSpec(tmpDir, spec);
    expect(path.basename(result.filePath)).toBe("my-special-test-1.yaml");
  });

  it("creates directory if missing", async () => {
    const nestedDir = path.join(tmpDir, "nested", "specs");
    const spec = { name: "Test" };
    const result = await writeSpec(nestedDir, spec);
    const content = await fs.readFile(result.filePath, "utf-8");
    expect(content).toContain("Test");
  });

  it("uses custom filename when provided", async () => {
    const spec = { name: "Test" };
    const result = await writeSpec(tmpDir, spec, { filename: "custom.yaml" });
    expect(path.basename(result.filePath)).toBe("custom.yaml");
  });

  it("uses 'untitled-spec' when name is missing", async () => {
    const spec = { description: "no name" };
    const result = await writeSpec(tmpDir, spec);
    expect(path.basename(result.filePath)).toBe("untitled-spec.yaml");
  });
});

describe("extractYamlBlocks", () => {
  it("extracts from fenced yaml blocks", () => {
    const text = "Some text\n```yaml\nname: Test\ntype: web\n```\nMore text";
    const blocks = extractYamlBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].name).toBe("Test");
  });

  it("extracts from fenced yml blocks", () => {
    const text = "```yml\nname: Test\n```";
    const blocks = extractYamlBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].name).toBe("Test");
  });

  it("handles multiple fenced blocks", () => {
    const text = "```yaml\nname: A\n```\n\n```yaml\nname: B\n```";
    const blocks = extractYamlBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].name).toBe("A");
    expect(blocks[1].name).toBe("B");
  });

  it("falls back to whole-text YAML parsing when no fenced blocks", () => {
    const text = "name: Direct\ndescription: no fence";
    const blocks = extractYamlBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].name).toBe("Direct");
  });

  it("returns empty for non-YAML text", () => {
    const text = "This is just plain text with no YAML structure";
    const blocks = extractYamlBlocks(text);
    expect(blocks).toHaveLength(0);
  });

  it("skips invalid YAML in fenced blocks", () => {
    const text = "```yaml\n{ invalid yaml: [\n```\n\n```yaml\nname: Valid\n```";
    const blocks = extractYamlBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].name).toBe("Valid");
  });

  it("whole-text fallback requires 'name' property", () => {
    // Object without 'name' should not match in fallback
    const text = "description: no name here";
    const blocks = extractYamlBlocks(text);
    expect(blocks).toHaveLength(0);
  });
});
