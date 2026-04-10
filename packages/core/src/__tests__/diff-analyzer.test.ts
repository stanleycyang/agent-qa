import { describe, it, expect } from "vitest";
import { analyzeChangedFiles } from "../diff-analyzer.js";
import type { AgentQASpec } from "../types.js";

function makeSpec(name: string, triggerPaths?: string[]): { spec: AgentQASpec; path: string } {
  return {
    spec: {
      name,
      trigger: { paths: triggerPaths },
      environment: { type: "web" },
      scenarios: [{ name: "test", expect: ["something works"] }],
    },
    path: `/specs/${name}.yaml`,
  };
}

describe("analyzeChangedFiles", () => {
  it("specs with no trigger paths match all changed files", () => {
    const specs = [makeSpec("no-triggers")];
    const result = analyzeChangedFiles(["src/foo.ts"], specs);
    expect(result.matchedSpecs).toHaveLength(1);
    expect(result.matchedSpecs[0].spec.name).toBe("no-triggers");
  });

  it("specs with empty trigger paths array match all changed files", () => {
    const specs = [makeSpec("empty-triggers", [])];
    const result = analyzeChangedFiles(["src/foo.ts"], specs);
    expect(result.matchedSpecs).toHaveLength(1);
  });

  it("matches changed files against glob patterns", () => {
    const specs = [makeSpec("checkout", ["src/checkout/**"])];
    const result = analyzeChangedFiles(["src/checkout/cart.ts"], specs);
    expect(result.matchedSpecs).toHaveLength(1);
    expect(result.matchedSpecs[0].spec.name).toBe("checkout");
  });

  it("does not match when changed files do not match trigger patterns", () => {
    const specs = [makeSpec("checkout", ["src/checkout/**"])];
    const result = analyzeChangedFiles(["src/auth/login.ts"], specs);
    expect(result.matchedSpecs).toHaveLength(0);
  });

  it("handles multiple specs with mixed matching", () => {
    const specs = [
      makeSpec("checkout", ["src/checkout/**"]),
      makeSpec("auth", ["src/auth/**"]),
      makeSpec("no-filter"),
    ];
    const result = analyzeChangedFiles(["src/auth/login.ts"], specs);
    // auth matches via glob, no-filter matches because no trigger paths
    expect(result.matchedSpecs).toHaveLength(2);
    const names = result.matchedSpecs.map(s => s.spec.name);
    expect(names).toContain("auth");
    expect(names).toContain("no-filter");
  });

  it("handles wildcard patterns like *.ts", () => {
    const specs = [makeSpec("ts-files", ["**/*.ts"])];
    const result = analyzeChangedFiles(["src/utils/helper.ts"], specs);
    expect(result.matchedSpecs).toHaveLength(1);
  });

  it("returns empty matchedSpecs for empty specs array", () => {
    const result = analyzeChangedFiles(["src/foo.ts"], []);
    expect(result.matchedSpecs).toHaveLength(0);
  });

  it("returns changedFiles in the result", () => {
    const files = ["a.ts", "b.ts"];
    const result = analyzeChangedFiles(files, []);
    expect(result.changedFiles).toEqual(files);
  });

  it("no changed files still matches specs with no triggers", () => {
    const specs = [makeSpec("always-run")];
    const result = analyzeChangedFiles([], specs);
    expect(result.matchedSpecs).toHaveLength(1);
  });

  it("multiple trigger patterns: match if any pattern matches", () => {
    const specs = [makeSpec("multi", ["src/a/**", "src/b/**"])];
    const result = analyzeChangedFiles(["src/b/file.ts"], specs);
    expect(result.matchedSpecs).toHaveLength(1);
  });
});
