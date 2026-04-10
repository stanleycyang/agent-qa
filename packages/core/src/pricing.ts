/**
 * Token pricing for cost telemetry.
 * Rates are USD per 1 million tokens, sourced from Anthropic's pricing page.
 */

import { TokenUsage } from "./types.js";

export function emptyUsage(): TokenUsage {
  return { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0 };
}

export function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_read_tokens: a.cache_read_tokens + b.cache_read_tokens,
    cache_creation_tokens: a.cache_creation_tokens + b.cache_creation_tokens,
  };
}

/** USD per 1M tokens, keyed by model id prefix. */
const PRICING: Record<string, { input: number; output: number; cache_read: number; cache_write: number }> = {
  "claude-opus-4": { input: 15, output: 75, cache_read: 1.5, cache_write: 18.75 },
  "claude-sonnet-4": { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
  "claude-haiku-4": { input: 0.8, output: 4, cache_read: 0.08, cache_write: 1.0 },
  "claude-3-5-sonnet": { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
  "claude-3-5-haiku": { input: 0.8, output: 4, cache_read: 0.08, cache_write: 1.0 },
};

function findPricing(model: string): { input: number; output: number; cache_read: number; cache_write: number } {
  // Try exact match first, then prefix match
  for (const [prefix, rates] of Object.entries(PRICING)) {
    if (model.startsWith(prefix)) return rates;
  }
  // Fallback to Sonnet pricing if model unknown
  return PRICING["claude-sonnet-4"];
}

/** Compute estimated USD cost for a given usage + model. */
export function computeCost(usage: TokenUsage, model: string): number {
  const rates = findPricing(model);
  return (
    (usage.input_tokens * rates.input) / 1_000_000 +
    (usage.output_tokens * rates.output) / 1_000_000 +
    (usage.cache_read_tokens * rates.cache_read) / 1_000_000 +
    (usage.cache_creation_tokens * rates.cache_write) / 1_000_000
  );
}
