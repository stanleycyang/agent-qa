import { describe, it, expect } from "vitest";
import { ReporterAgent } from "../reporter-agent.js";
import type { SpecResult, ScenarioResult } from "@agentqa/core";

function makeScenarioResult(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    scenario: "Happy path",
    status: "pass",
    expectations: [{ text: "Page loads", status: "pass", confidence: 0.95 }],
    duration_ms: 1500,
    ...overrides,
  };
}

function makeSpecResult(overrides: Partial<SpecResult> = {}): SpecResult {
  return {
    spec: "Login",
    scenarios: [makeScenarioResult()],
    status: "pass",
    duration_ms: 1500,
    ...overrides,
  };
}

describe("ReporterAgent", () => {
  const reporter = new ReporterAgent();

  describe("generateMarkdown", () => {
    it("generates report with all-pass results", () => {
      const md = reporter.generateMarkdown([makeSpecResult()]);
      expect(md).toContain("AgentQA Results");
      expect(md).toContain("1 specs");
      expect(md).toContain("1 passed");
      expect(md).toContain("0 failed");
      expect(md).toContain("✅");
    });

    it("generates report with failures", () => {
      const failed = makeSpecResult({
        spec: "Checkout",
        status: "fail",
        scenarios: [
          makeScenarioResult({
            status: "fail",
            expectations: [
              {
                text: "Order confirmation visible",
                status: "fail",
                confidence: 0.8,
                evidence: "Page shows error",
                reasoning: "Network timeout",
              },
            ],
          }),
        ],
      });
      const md = reporter.generateMarkdown([failed]);
      expect(md).toContain("❌");
      expect(md).toContain("Failures");
      expect(md).toContain("Order confirmation visible");
      expect(md).toContain("Page shows error");
      expect(md).toContain("Network timeout");
    });

    it("generates report with errors", () => {
      const errored = makeSpecResult({
        status: "fail",
        scenarios: [
          makeScenarioResult({
            status: "error",
            error: "Browser crashed",
          }),
        ],
      });
      const md = reporter.generateMarkdown([errored]);
      expect(md).toContain("⚠️");
      expect(md).toContain("Browser crashed");
    });

    it("includes impact analysis section when provided", () => {
      const md = reporter.generateMarkdown([makeSpecResult()], {
        impact: [
          { spec: "Login", score: 1.0, reasons: ["path match"], matchedBy: "path" },
          { spec: "Checkout", score: 0.8, reasons: ["semantic"], matchedBy: "semantic" },
        ],
      });
      expect(md).toContain("Impact Analysis");
      expect(md).toContain("📁");
      expect(md).toContain("🧠");
    });

    it("includes cost information when provided", () => {
      const md = reporter.generateMarkdown([makeSpecResult()], {
        totalCost: { input_tokens: 1000, output_tokens: 500, usd: 0.0234 },
      });
      expect(md).toContain("$0.0234");
    });

    it("includes confidence floor when provided", () => {
      const md = reporter.generateMarkdown([makeSpecResult()], {
        confidenceFloor: 0.7,
      });
      expect(md).toContain("confidence floor: 70%");
    });

    it("includes proposed fix section", () => {
      const withFix = makeSpecResult({
        status: "fail",
        scenarios: [
          makeScenarioResult({
            status: "fail",
            proposedFix: {
              files: [{ path: "src/app.ts", diff: "- old\n+ new", rationale: "Fix the bug" }],
              confidence: 0.85,
              summary: "Apply a simple fix",
              oversized: false,
            },
          }),
        ],
      });
      const md = reporter.generateMarkdown([withFix]);
      expect(md).toContain("Proposed Fix");
      expect(md).toContain("85%");
      expect(md).toContain("Apply a simple fix");
      expect(md).toContain("src/app.ts");
    });

    it("marks oversized proposed fixes", () => {
      const withFix = makeSpecResult({
        status: "fail",
        scenarios: [
          makeScenarioResult({
            status: "fail",
            proposedFix: {
              files: [],
              confidence: 0.5,
              summary: "Big fix",
              oversized: true,
            },
          }),
        ],
      });
      const md = reporter.generateMarkdown([withFix]);
      expect(md).toContain("oversized");
    });

    it("truncates report at 60k chars", () => {
      // Generate many specs to exceed 60k chars
      const results: SpecResult[] = [];
      for (let i = 0; i < 500; i++) {
        results.push(
          makeSpecResult({
            spec: `Spec ${i} ${"x".repeat(100)}`,
            status: "fail",
            scenarios: [
              makeScenarioResult({
                status: "fail",
                error: "x".repeat(200),
              }),
            ],
          }),
        );
      }
      const md = reporter.generateMarkdown(results);
      expect(md.length).toBeLessThan(61000);
      expect(md).toContain("Report truncated");
    });

    it("includes screenshots in failure details", () => {
      const withScreenshots = makeSpecResult({
        status: "fail",
        scenarios: [
          makeScenarioResult({
            status: "fail",
            screenshots: ["/screenshots/failure.png"],
          }),
        ],
      });
      const md = reporter.generateMarkdown([withScreenshots]);
      expect(md).toContain("Screenshots");
      expect(md).toContain("failure.png");
    });

    it("shows flaky and perf regression tags in passed section", () => {
      const result = makeSpecResult({
        scenarios: [
          makeScenarioResult({
            flaky: { rate: 0.3, runs: 10 },
            perf_regression: { baseline_ms: 1000, current_ms: 2500, ratio: 2.5 },
          }),
        ],
      });
      const md = reporter.generateMarkdown([result]);
      expect(md).toContain("flaky");
      expect(md).toContain("30%");
      expect(md).toContain("2.5×");
      expect(md).toContain("slower");
    });

    it("includes artifact URL in footer when provided", () => {
      const md = reporter.generateMarkdown([makeSpecResult()], {
        artifactUrl: "https://github.com/example/artifacts/123",
      });
      expect(md).toContain("View screenshots and artifacts");
      expect(md).toContain("https://github.com/example/artifacts/123");
    });

    it("includes low confidence warning", () => {
      const result = makeSpecResult({
        status: "fail",
        scenarios: [
          makeScenarioResult({
            status: "fail",
            expectations: [
              { text: "Check X", status: "fail", confidence: 0.5, low_confidence: true },
            ],
          }),
        ],
      });
      const md = reporter.generateMarkdown([result]);
      expect(md).toContain("below threshold");
    });
  });

  describe("generateSummary", () => {
    it("returns correct counts for all-pass", () => {
      const summary = reporter.generateSummary([makeSpecResult()]);
      expect(summary).toEqual({ passed: 1, failed: 0, errors: 0, total: 1 });
    });

    it("returns correct counts for mixed results", () => {
      const results: SpecResult[] = [
        makeSpecResult({
          scenarios: [
            makeScenarioResult({ status: "pass" }),
            makeScenarioResult({ status: "fail" }),
            makeScenarioResult({ status: "error" }),
          ],
        }),
      ];
      const summary = reporter.generateSummary(results);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(2); // fail + error = 2 non-pass
      expect(summary.errors).toBe(1);
      expect(summary.total).toBe(3);
    });

    it("returns zeros for empty results", () => {
      const summary = reporter.generateSummary([]);
      expect(summary).toEqual({ passed: 0, failed: 0, errors: 0, total: 0 });
    });
  });

  describe("generateJUnit", () => {
    it("produces valid XML structure", () => {
      const xml = reporter.generateJUnit([makeSpecResult()]);
      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain("<testsuites");
      expect(xml).toContain("<testsuite");
      expect(xml).toContain("<testcase");
      expect(xml).toContain("</testsuites>");
    });

    it("includes pass, fail, and error scenarios", () => {
      const result = makeSpecResult({
        spec: "Mixed",
        status: "fail",
        scenarios: [
          makeScenarioResult({ scenario: "pass-test", status: "pass" }),
          makeScenarioResult({
            scenario: "fail-test",
            status: "fail",
            expectations: [
              { text: "should work", status: "fail", evidence: "broken" },
            ],
          }),
          makeScenarioResult({
            scenario: "error-test",
            status: "error",
            error: "Timeout",
          }),
        ],
      });
      const xml = reporter.generateJUnit([result]);
      expect(xml).toContain('name="pass-test"');
      expect(xml).toContain("<failure");
      expect(xml).toContain("<error");
      expect(xml).toContain("Timeout");
    });

    it("escapes XML special characters", () => {
      const result = makeSpecResult({
        spec: 'Test & <"Suite">',
        scenarios: [
          makeScenarioResult({ scenario: "a 'test'" }),
        ],
      });
      const xml = reporter.generateJUnit([result]);
      expect(xml).toContain("&amp;");
      expect(xml).toContain("&lt;");
      expect(xml).toContain("&gt;");
      expect(xml).toContain("&quot;");
      expect(xml).toContain("&apos;");
    });

    it("includes correct test counts", () => {
      const results = [
        makeSpecResult({
          scenarios: [
            makeScenarioResult({ status: "pass" }),
            makeScenarioResult({ status: "fail" }),
          ],
        }),
      ];
      const xml = reporter.generateJUnit(results);
      expect(xml).toContain('tests="2"');
      expect(xml).toContain('failures="1"');
    });
  });
});
