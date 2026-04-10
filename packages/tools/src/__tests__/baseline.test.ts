import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { BaselineStore } from "../baseline.js";

let tmpDir: string;
let store: BaselineStore;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "agentqa-baseline-"));
  store = new BaselineStore(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("BaselineStore", () => {
  it("exists returns false for non-existent baseline", async () => {
    expect(await store.exists("spec", "scenario", "screenshot")).toBe(false);
  });

  it("save then exists returns true", async () => {
    const base64 = Buffer.from("fake-image-data").toString("base64");
    await store.save("spec", "scenario", "screenshot", base64);
    expect(await store.exists("spec", "scenario", "screenshot")).toBe(true);
  });

  it("save then load returns correct base64 content", async () => {
    const originalData = "hello world baseline image";
    const base64 = Buffer.from(originalData).toString("base64");
    await store.save("spec", "scenario", "screenshot", base64);
    const loaded = await store.load("spec", "scenario", "screenshot");
    expect(loaded).toBe(base64);
    // Verify round-trip
    expect(Buffer.from(loaded!, "base64").toString()).toBe(originalData);
  });

  it("load returns null for non-existent baseline", async () => {
    expect(await store.load("spec", "scenario", "missing")).toBeNull();
  });

  it("sanitizes special characters in names", async () => {
    const base64 = Buffer.from("data").toString("base64");
    const filePath = await store.save("My Spec!", "Scenario #1", "base@line", base64);
    // File should be created successfully
    expect(await store.exists("My Spec!", "Scenario #1", "base@line")).toBe(true);
    // Path should contain sanitized names
    expect(filePath).toContain("My-Spec-");
    expect(filePath).toContain("Scenario--1");
  });

  it("creates nested directory structure", async () => {
    const base64 = Buffer.from("data").toString("base64");
    await store.save("spec", "scenario", "screenshot", base64);
    // Check that the directory structure exists
    const dir = path.join(tmpDir, "spec", "scenario");
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("overwrites existing baseline on save", async () => {
    const base64a = Buffer.from("version-1").toString("base64");
    const base64b = Buffer.from("version-2").toString("base64");
    await store.save("spec", "scenario", "shot", base64a);
    await store.save("spec", "scenario", "shot", base64b);
    const loaded = await store.load("spec", "scenario", "shot");
    expect(Buffer.from(loaded!, "base64").toString()).toBe("version-2");
  });
});
