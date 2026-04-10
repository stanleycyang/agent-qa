import { describe, it, expect, vi, beforeEach } from "vitest";
import * as yaml from "js-yaml";

// Mock fs/promises before importing the module
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

import { parseSpec, parseConfig, loadAllSpecs } from "../spec-parser.js";
import * as fs from "fs/promises";

const mockedFs = vi.mocked(fs);

const validSpecYaml = yaml.dump({
  name: "Login Flow",
  description: "Test login",
  trigger: { paths: ["src/auth/**"] },
  environment: { type: "web", base_url: "https://example.com" },
  scenarios: [
    {
      name: "Happy path login",
      steps: ["Navigate to /login", "Enter credentials"],
      expect: ["User sees dashboard"],
      on_failure: "screenshot",
    },
  ],
});

const minimalSpecYaml = yaml.dump({
  name: "Minimal",
  trigger: {},
  environment: { type: "logic" },
  scenarios: [{ name: "basic", expect: ["it works"] }],
});

const validConfigYaml = yaml.dump({
  version: 1,
  model: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
  execution: { concurrency: 3, timeout_per_scenario: 120 },
  environment: { preview_url: "{{PREVIEW_URL}}" },
});

const minimalConfigYaml = yaml.dump({ version: 1 });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("parseSpec", () => {
  it("parses a valid spec YAML", async () => {
    mockedFs.readFile.mockResolvedValue(validSpecYaml);
    const spec = await parseSpec("/specs/login.yaml");
    expect(spec.name).toBe("Login Flow");
    expect(spec.environment.type).toBe("web");
    expect(spec.scenarios).toHaveLength(1);
    expect(spec.trigger.paths).toEqual(["src/auth/**"]);
  });

  it("parses a minimal spec (optional fields omitted)", async () => {
    mockedFs.readFile.mockResolvedValue(minimalSpecYaml);
    const spec = await parseSpec("/specs/minimal.yaml");
    expect(spec.name).toBe("Minimal");
    expect(spec.description).toBeUndefined();
    expect(spec.trigger.paths).toBeUndefined();
  });

  it("throws on invalid YAML (missing required fields)", async () => {
    const invalidYaml = yaml.dump({ name: "Broken" });
    mockedFs.readFile.mockResolvedValue(invalidYaml);
    await expect(parseSpec("/specs/bad.yaml")).rejects.toThrow();
  });

  it("throws on malformed YAML syntax", async () => {
    mockedFs.readFile.mockResolvedValue("{ invalid: yaml: [");
    await expect(parseSpec("/specs/bad.yaml")).rejects.toThrow();
  });

  it("validates environment type enum", async () => {
    const badType = yaml.dump({
      name: "Bad",
      trigger: {},
      environment: { type: "invalid_type" },
      scenarios: [{ name: "x", expect: ["y"] }],
    });
    mockedFs.readFile.mockResolvedValue(badType);
    await expect(parseSpec("/specs/bad.yaml")).rejects.toThrow();
  });
});

describe("parseConfig", () => {
  it("parses a full config", async () => {
    mockedFs.readFile.mockResolvedValue(validConfigYaml);
    const config = await parseConfig("/config.yaml");
    expect(config.version).toBe(1);
    expect(config.model?.model).toBe("claude-sonnet-4-20250514");
    expect(config.execution?.concurrency).toBe(3);
  });

  it("parses a minimal config (just version)", async () => {
    mockedFs.readFile.mockResolvedValue(minimalConfigYaml);
    const config = await parseConfig("/config.yaml");
    expect(config.version).toBe(1);
    expect(config.model).toBeUndefined();
  });
});

describe("loadAllSpecs", () => {
  it("loads multiple valid specs", async () => {
    mockedFs.readdir.mockResolvedValue(["a.yaml", "b.yml"] as any);
    mockedFs.readFile
      .mockResolvedValueOnce(validSpecYaml)
      .mockResolvedValueOnce(minimalSpecYaml);
    const result = await loadAllSpecs("/specs");
    expect(result).toHaveLength(2);
  });

  it("returns empty array for directory with no YAML files", async () => {
    mockedFs.readdir.mockResolvedValue(["readme.md", "config.json"] as any);
    const result = await loadAllSpecs("/specs");
    expect(result).toHaveLength(0);
  });

  it("skips invalid specs but returns valid ones", async () => {
    mockedFs.readdir.mockResolvedValue(["good.yaml", "bad.yaml"] as any);
    mockedFs.readFile
      .mockResolvedValueOnce(validSpecYaml)
      .mockResolvedValueOnce(yaml.dump({ name: "broken" }));
    const result = await loadAllSpecs("/specs");
    expect(result).toHaveLength(1);
    expect(result[0].spec.name).toBe("Login Flow");
  });

  it("throws when ALL specs fail to parse", async () => {
    mockedFs.readdir.mockResolvedValue(["bad1.yaml", "bad2.yaml"] as any);
    mockedFs.readFile
      .mockResolvedValueOnce(yaml.dump({ name: "bad1" }))
      .mockResolvedValueOnce(yaml.dump({ name: "bad2" }));
    await expect(loadAllSpecs("/specs")).rejects.toThrow("All spec files failed to parse");
  });

  it("filters only .yaml and .yml files", async () => {
    mockedFs.readdir.mockResolvedValue(["spec.yaml", "other.txt", "spec2.yml"] as any);
    mockedFs.readFile
      .mockResolvedValueOnce(validSpecYaml)
      .mockResolvedValueOnce(minimalSpecYaml);
    const result = await loadAllSpecs("/specs");
    expect(result).toHaveLength(2);
    // readFile should only be called twice (for the 2 YAML files)
    expect(mockedFs.readFile).toHaveBeenCalledTimes(2);
  });
});
