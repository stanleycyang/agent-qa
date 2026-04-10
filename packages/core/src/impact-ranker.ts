import { AgentQASpec } from "./types.js";
import { DiffAnalysisResult } from "./diff-analyzer.js";

export interface RankedSpec {
  spec: AgentQASpec;
  specPath: string;
  score: number;
  reasons: string[];
  matchedBy: "path" | "semantic" | "both";
}

/**
 * Merge path-based hits (from diff-analyzer) with semantic hits (from LLM ranking)
 * into a single sorted list. Path matches anchor at score 1.0; semantic scores
 * are 0..1 from the LLM. "both" means both matched.
 */
export function mergeRankings(
  pathHits: DiffAnalysisResult,
  semanticHits: Array<{ name: string; score: number; reason: string }>,
  allSpecs: Array<{ spec: AgentQASpec; path: string }>,
): RankedSpec[] {
  const map = new Map<string, RankedSpec>();

  // Seed from path matches
  for (const { spec, specPath } of pathHits.matchedSpecs) {
    map.set(spec.name, {
      spec,
      specPath,
      score: 1.0,
      reasons: ["trigger path matched changed files"],
      matchedBy: "path",
    });
  }

  // Merge semantic hits
  for (const hit of semanticHits) {
    const existing = map.get(hit.name);
    if (existing) {
      // Already matched by path — upgrade to "both"
      existing.matchedBy = "both";
      existing.score = Math.max(existing.score, hit.score);
      existing.reasons.push(hit.reason);
    } else {
      // Find spec entry by name
      const entry = allSpecs.find(s => s.spec.name === hit.name);
      if (entry) {
        map.set(hit.name, {
          spec: entry.spec,
          specPath: entry.path,
          score: hit.score,
          reasons: [hit.reason],
          matchedBy: "semantic",
        });
      }
    }
  }

  // Sort descending by score
  return [...map.values()].sort((a, b) => b.score - a.score);
}
