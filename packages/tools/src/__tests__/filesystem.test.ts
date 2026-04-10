import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { FilesystemTool } from "../filesystem.js";

let tmpDir: string;
const tool = new FilesystemTool();

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "agentqa-fs-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("FilesystemTool", () => {
  describe("readFile", () => {
    it("returns file content", async () => {
      const filePath = path.join(tmpDir, "test.txt");
      await fs.writeFile(filePath, "hello world");
      const result = await tool.readFile(filePath);
      expect(result.content).toBe("hello world");
    });

    it("throws for non-existent file", async () => {
      await expect(tool.readFile(path.join(tmpDir, "missing.txt"))).rejects.toThrow();
    });
  });

  describe("listDir", () => {
    it("returns file list", async () => {
      await fs.writeFile(path.join(tmpDir, "a.txt"), "");
      await fs.writeFile(path.join(tmpDir, "b.txt"), "");
      const result = await tool.listDir(tmpDir);
      expect(result.files.sort()).toEqual(["a.txt", "b.txt"]);
    });

    it("returns empty array for empty directory", async () => {
      const result = await tool.listDir(tmpDir);
      expect(result.files).toEqual([]);
    });
  });

  describe("grepFile", () => {
    it("returns regex matches", async () => {
      const filePath = path.join(tmpDir, "code.ts");
      await fs.writeFile(filePath, "const foo = 1;\nconst bar = 2;\nlet baz = 3;");
      const result = await tool.grepFile(filePath, "const \\w+");
      expect(result.matches).toEqual(["const foo", "const bar"]);
    });

    it("returns empty for no matches", async () => {
      const filePath = path.join(tmpDir, "code.ts");
      await fs.writeFile(filePath, "hello world");
      const result = await tool.grepFile(filePath, "xyz123");
      expect(result.matches).toEqual([]);
    });
  });

  describe("exists", () => {
    it("returns true for existing file", async () => {
      const filePath = path.join(tmpDir, "exists.txt");
      await fs.writeFile(filePath, "");
      const result = await tool.exists(filePath);
      expect(result.exists).toBe(true);
    });

    it("returns false for non-existent file", async () => {
      const result = await tool.exists(path.join(tmpDir, "nope.txt"));
      expect(result.exists).toBe(false);
    });

    it("returns true for directory", async () => {
      const result = await tool.exists(tmpDir);
      expect(result.exists).toBe(true);
    });
  });
});
