import { describe, it, expect, vi, beforeEach } from "vitest";
import * as yaml from "js-yaml";

vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

import { Orchestrator } from "../orchestrator.js";
import * as fs from "fs/promises";

const mockedFs = vi.mocked(fs);

const configYaml = yaml.dump({
  version: 1,
  environment: { preview_url: "https://example.com" },
});

const specYaml = yaml.dump({
  name: "Test Spec",
  trigger: { paths: ["src/**"] },
  environment: { type: "web" },
  scenarios: [{ name: "scenario1", expect: ["works"] }],
});

const untriggeredSpecYaml = yaml.dump({
  name: "Always Run",
  trigger: {},
  environment: { type: "logic" },
  scenarios: [{ name: "check", expect: ["ok"] }],
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Orchestrator", () => {
  it("initialize loads config", async () => {
    mockedFs.readFile.mockResolvedValue(configYaml);
    const orch = new Orchestrator("/project/.agentqa/config.yaml", "/project");
    await orch.initialize();
    const config = orch.getConfig();
    expect(config.version).toBe(1);
    expect(config.environment?.preview_url).toBe("https://example.com");
  });

  it("buildPlan with no changedFiles runs all specs", async () => {
    mockedFs.readFile
      .mockResolvedValueOnce(configYaml) // initialize
      .mockResolvedValueOnce(specYaml); // loadAllSpecs
    mockedFs.readdir.mockResolvedValue(["test.yaml"] as any);

    const orch = new Orchestrator("/project/.agentqa/config.yaml", "/project");
    await orch.initialize();
    const plan = await orch.buildPlan();
    expect(plan.specs).toHaveLength(1);
    expect(plan.specs[0].spec.name).toBe("Test Spec");
  });

  it("buildPlan with changedFiles filters by trigger paths", async () => {
    mockedFs.readFile
      .mockResolvedValueOnce(configYaml)
      .mockResolvedValueOnce(specYaml)
      .mockResolvedValueOnce(untriggeredSpecYaml);
    mockedFs.readdir.mockResolvedValue(["test.yaml", "always.yaml"] as any);

    const orch = new Orchestrator("/project/.agentqa/config.yaml", "/project");
    await orch.initialize();
    const plan = await orch.buildPlan(["README.md"]);
    // Only the untriggered spec matches (no trigger paths = match all)
    // The triggered spec (src/**) doesn't match README.md
    expect(plan.specs).toHaveLength(1);
    expect(plan.specs[0].spec.name).toBe("Always Run");
  });

  it("buildPlan with matching changedFiles includes triggered spec", async () => {
    mockedFs.readFile
      .mockResolvedValueOnce(configYaml)
      .mockResolvedValueOnce(specYaml);
    mockedFs.readdir.mockResolvedValue(["test.yaml"] as any);

    const orch = new Orchestrator("/project/.agentqa/config.yaml", "/project");
    await orch.initialize();
    const plan = await orch.buildPlan(["src/index.ts"]);
    expect(plan.specs).toHaveLength(1);
    expect(plan.specs[0].spec.name).toBe("Test Spec");
  });
});
