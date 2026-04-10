import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveEnv } from "../scenario-runner.js";

// Mock detectPreviewUrl from @agentqa/core
vi.mock("@agentqa/core", async () => {
  const actual = await vi.importActual("@agentqa/core");
  return {
    ...actual,
    detectPreviewUrl: vi.fn(() => null),
  };
});

import { detectPreviewUrl } from "@agentqa/core";
const mockedDetect = vi.mocked(detectPreviewUrl);

describe("resolveEnv", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {};
    vi.resetAllMocks();
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val !== undefined) {
        process.env[key] = val;
      } else {
        delete process.env[key];
      }
    }
  });

  function setEnv(key: string, value: string) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }

  it("substitutes {{VAR}} with process.env value", () => {
    setEnv("MY_URL", "https://example.com");
    expect(resolveEnv("{{MY_URL}}")).toBe("https://example.com");
  });

  it("returns empty string for missing env var", () => {
    expect(resolveEnv("{{NONEXISTENT_VAR}}")).toBe("");
  });

  it("handles multiple placeholders in one string", () => {
    setEnv("HOST", "localhost");
    setEnv("PORT", "3000");
    expect(resolveEnv("http://{{HOST}}:{{PORT}}/api")).toBe("http://localhost:3000/api");
  });

  it("{{PREVIEW_URL}} falls back to detectPreviewUrl()", () => {
    mockedDetect.mockReturnValue("https://detected.vercel.app");
    expect(resolveEnv("{{PREVIEW_URL}}")).toBe("https://detected.vercel.app");
    expect(mockedDetect).toHaveBeenCalled();
  });

  it("{{PREVIEW_URL}} uses process.env if set (before detection)", () => {
    setEnv("PREVIEW_URL", "https://from-env.com");
    expect(resolveEnv("{{PREVIEW_URL}}")).toBe("https://from-env.com");
    expect(mockedDetect).not.toHaveBeenCalled();
  });

  it("{{PREVIEW_URL}} returns empty when detectPreviewUrl returns null", () => {
    mockedDetect.mockReturnValue(null);
    expect(resolveEnv("{{PREVIEW_URL}}")).toBe("");
  });

  it("returns undefined for undefined input", () => {
    expect(resolveEnv(undefined)).toBeUndefined();
  });

  it("returns empty string for empty input", () => {
    expect(resolveEnv("")).toBeUndefined();
  });

  it("returns string as-is when no placeholders", () => {
    expect(resolveEnv("https://example.com")).toBe("https://example.com");
  });

  it("handles adjacent placeholders", () => {
    setEnv("A", "hello");
    setEnv("B", "world");
    expect(resolveEnv("{{A}}{{B}}")).toBe("helloworld");
  });
});
