/**
 * Token pricing for cost telemetry.
 * Rates are USD per 1 million tokens, sourced from Anthropic's pricing page.
 */
import { TokenUsage } from "./types.js";
export declare function emptyUsage(): TokenUsage;
export declare function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage;
/** Compute estimated USD cost for a given usage + model. */
export declare function computeCost(usage: TokenUsage, model: string): number;
//# sourceMappingURL=pricing.d.ts.map