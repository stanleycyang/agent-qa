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
export declare function mergeRankings(pathHits: DiffAnalysisResult, semanticHits: Array<{
    name: string;
    score: number;
    reason: string;
}>, allSpecs: Array<{
    spec: AgentQASpec;
    path: string;
}>): RankedSpec[];
//# sourceMappingURL=impact-ranker.d.ts.map