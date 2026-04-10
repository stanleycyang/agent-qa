import { describe, it, expect } from "vitest";
import { buildExecutionPlan } from "../plan-builder.js";
import type { AgentQASpec, AgentQAConfig } from "../types.js";

function makeSpec(name: string): AgentQASpec {
  return {
    name,
    trigger: {},
    environment: { type: "web", base_url: "https://example.com" },
    scenarios: [
      { name: "scenario1", steps: ["step 1"], expect: ["it works"] },
    ],
  };
}

const baseConfig: AgentQAConfig = {
  version: 1,
  environment: {
    preview_url: "https://preview.example.com",
    api_url: "https://api.example.com",
  },
};

describe("buildExecutionPlan", () => {
  it("maps specs to plan with correct structure", () => {
    const spec = makeSpec("Login");
    const result = buildExecutionPlan(
      [{ spec, specPath: "/specs/login.yaml" }],
      baseConfig,
    );
    expect(result.specs).toHaveLength(1);
    expect(result.specs[0].spec.name).toBe("Login");
    expect(result.specs[0].specPath).toBe("/specs/login.yaml");
    expect(result.specs[0].scenarios).toEqual(spec.scenarios);
  });

  it("extracts environment URLs from config", () => {
    const result = buildExecutionPlan([], baseConfig);
    expect(result.environment.base_url).toBe("https://preview.example.com");
    expect(result.environment.api_url).toBe("https://api.example.com");
  });

  it("empty specs produces empty plan", () => {
    const result = buildExecutionPlan([], baseConfig);
    expect(result.specs).toHaveLength(0);
  });

  it("handles missing environment config", () => {
    const minimalConfig: AgentQAConfig = { version: 1 };
    const result = buildExecutionPlan([], minimalConfig);
    expect(result.environment.base_url).toBeUndefined();
    expect(result.environment.api_url).toBeUndefined();
  });

  it("handles multiple specs", () => {
    const specs = [
      { spec: makeSpec("Login"), specPath: "/specs/login.yaml" },
      { spec: makeSpec("Checkout"), specPath: "/specs/checkout.yaml" },
    ];
    const result = buildExecutionPlan(specs, baseConfig);
    expect(result.specs).toHaveLength(2);
  });
});
