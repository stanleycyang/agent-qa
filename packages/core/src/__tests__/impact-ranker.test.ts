import { describe, it, expect } from "vitest";
import { mergeRankings } from "../impact-ranker.js";
import type { DiffAnalysisResult } from "../diff-analyzer.js";
import type { AgentQASpec } from "../types.js";

function makeSpec(name: string): AgentQASpec {
  return {
    name,
    trigger: {},
    environment: { type: "web" },
    scenarios: [{ name: "test", expect: ["ok"] }],
  };
}

describe("mergeRankings", () => {
  it("path-only hits get score 1.0 and matchedBy 'path'", () => {
    const pathHits: DiffAnalysisResult = {
      changedFiles: ["a.ts"],
      matchedSpecs: [{ spec: makeSpec("Login"), specPath: "/specs/login.yaml" }],
    };
    const result = mergeRankings(pathHits, [], []);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(1.0);
    expect(result[0].matchedBy).toBe("path");
  });

  it("semantic-only hits get their score and matchedBy 'semantic'", () => {
    const allSpecs = [{ spec: makeSpec("Checkout"), path: "/specs/checkout.yaml" }];
    const semanticHits = [{ name: "Checkout", score: 0.8, reason: "related code" }];
    const pathHits: DiffAnalysisResult = { changedFiles: [], matchedSpecs: [] };
    const result = mergeRankings(pathHits, semanticHits, allSpecs);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(0.8);
    expect(result[0].matchedBy).toBe("semantic");
  });

  it("both path + semantic = matchedBy 'both' with max score", () => {
    const spec = makeSpec("Login");
    const pathHits: DiffAnalysisResult = {
      changedFiles: ["a.ts"],
      matchedSpecs: [{ spec, specPath: "/specs/login.yaml" }],
    };
    const semanticHits = [{ name: "Login", score: 0.9, reason: "semantic match" }];
    const allSpecs = [{ spec, path: "/specs/login.yaml" }];
    const result = mergeRankings(pathHits, semanticHits, allSpecs);
    expect(result).toHaveLength(1);
    expect(result[0].matchedBy).toBe("both");
    expect(result[0].score).toBe(1.0); // max(1.0, 0.9)
    expect(result[0].reasons).toHaveLength(2);
  });

  it("results are sorted descending by score", () => {
    const allSpecs = [
      { spec: makeSpec("Low"), path: "/specs/low.yaml" },
      { spec: makeSpec("High"), path: "/specs/high.yaml" },
    ];
    const pathHits: DiffAnalysisResult = { changedFiles: [], matchedSpecs: [] };
    const semanticHits = [
      { name: "Low", score: 0.3, reason: "low" },
      { name: "High", score: 0.9, reason: "high" },
    ];
    const result = mergeRankings(pathHits, semanticHits, allSpecs);
    expect(result[0].spec.name).toBe("High");
    expect(result[1].spec.name).toBe("Low");
  });

  it("semantic hit for non-existent spec is skipped", () => {
    const pathHits: DiffAnalysisResult = { changedFiles: [], matchedSpecs: [] };
    const semanticHits = [{ name: "DoesNotExist", score: 0.5, reason: "ghost" }];
    const result = mergeRankings(pathHits, semanticHits, []);
    expect(result).toHaveLength(0);
  });

  it("empty inputs return empty array", () => {
    const pathHits: DiffAnalysisResult = { changedFiles: [], matchedSpecs: [] };
    const result = mergeRankings(pathHits, [], []);
    expect(result).toEqual([]);
  });
});
