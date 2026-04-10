import { describe, it, expect } from "vitest";
import { emptyUsage, mergeUsage, computeCost } from "../pricing.js";

describe("emptyUsage", () => {
  it("returns all zeros", () => {
    const usage = emptyUsage();
    expect(usage).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
    });
  });
});

describe("mergeUsage", () => {
  it("adds fields element-wise", () => {
    const a = { input_tokens: 10, output_tokens: 20, cache_read_tokens: 30, cache_creation_tokens: 40 };
    const b = { input_tokens: 5, output_tokens: 15, cache_read_tokens: 25, cache_creation_tokens: 35 };
    expect(mergeUsage(a, b)).toEqual({
      input_tokens: 15,
      output_tokens: 35,
      cache_read_tokens: 55,
      cache_creation_tokens: 75,
    });
  });

  it("merges zero usage with non-zero", () => {
    const zero = emptyUsage();
    const nonZero = { input_tokens: 100, output_tokens: 200, cache_read_tokens: 50, cache_creation_tokens: 25 };
    expect(mergeUsage(zero, nonZero)).toEqual(nonZero);
  });

  it("merges two empty usages", () => {
    expect(mergeUsage(emptyUsage(), emptyUsage())).toEqual(emptyUsage());
  });
});

describe("computeCost", () => {
  it("computes cost for Opus model", () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0 };
    // Opus input rate: $15 per 1M tokens
    expect(computeCost(usage, "claude-opus-4")).toBe(15);
  });

  it("computes cost for Sonnet model", () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 1_000_000, cache_read_tokens: 0, cache_creation_tokens: 0 };
    // Sonnet: $3 input + $15 output = $18
    expect(computeCost(usage, "claude-sonnet-4")).toBe(18);
  });

  it("computes cost for Haiku model", () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 1_000_000, cache_read_tokens: 0, cache_creation_tokens: 0 };
    // Haiku: $0.8 input + $4 output = $4.8
    expect(computeCost(usage, "claude-haiku-4")).toBeCloseTo(4.8);
  });

  it("falls back to Sonnet pricing for unknown model", () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0 };
    // Unknown model should use Sonnet pricing: $3 per 1M input
    expect(computeCost(usage, "unknown-model-xyz")).toBe(3);
  });

  it("matches model by prefix (e.g. claude-sonnet-4-20250514)", () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0 };
    expect(computeCost(usage, "claude-sonnet-4-20250514")).toBe(3);
  });

  it("returns 0 for zero tokens", () => {
    expect(computeCost(emptyUsage(), "claude-opus-4")).toBe(0);
  });

  it("includes cache token costs", () => {
    const usage = {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 1_000_000,
      cache_creation_tokens: 1_000_000,
    };
    // Opus cache rates: read=$1.5, write=$18.75
    expect(computeCost(usage, "claude-opus-4")).toBeCloseTo(20.25);
  });

  it("computes combined cost across all token types", () => {
    const usage = {
      input_tokens: 500_000,
      output_tokens: 100_000,
      cache_read_tokens: 200_000,
      cache_creation_tokens: 50_000,
    };
    // Sonnet: 500k*3/1M + 100k*15/1M + 200k*0.3/1M + 50k*3.75/1M
    // = 1.5 + 1.5 + 0.06 + 0.1875 = 3.2475
    expect(computeCost(usage, "claude-sonnet-4")).toBeCloseTo(3.2475);
  });

  it("handles claude-3-5-sonnet prefix", () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0 };
    expect(computeCost(usage, "claude-3-5-sonnet-20241022")).toBe(3);
  });
});
