import { SpecResult, ScenarioResult, ProposedFix } from "@agentqa/core";

export interface ReportOptions {
  artifactUrl?: string;
  impact?: Array<{ spec: string; score: number; reasons: string[]; matchedBy: string }>;
  totalCost?: { input_tokens: number; output_tokens: number; usd: number };
  confidenceFloor?: number;
}

export class ReporterAgent {
  generateMarkdown(results: SpecResult[], options?: ReportOptions): string {
    const totalScenarios = results.reduce((sum, r) => sum + r.scenarios.length, 0);
    const passedScenarios = results.reduce(
      (sum, r) => sum + r.scenarios.filter(s => s.status === "pass").length,
      0
    );
    const failedScenarios = totalScenarios - passedScenarios;
    const errorScenarios = results.reduce(
      (sum, r) => sum + r.scenarios.filter(s => s.status === "error").length,
      0
    );
    const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);
    const statusEmoji = failedScenarios > 0 ? "❌" : "✅";

    const parts: string[] = [];

    // --- Summary ---
    let summary = `## 🤖 AgentQA Results ${statusEmoji}\n\n`;
    summary += `**${results.length} specs · ${totalScenarios} scenarios · `;
    summary += `${passedScenarios} passed · ${failedScenarios} failed`;
    if (errorScenarios > 0) summary += ` · ${errorScenarios} errors`;
    summary += `** (${(totalDuration / 1000).toFixed(1)}s)`;
    if (options?.totalCost && options.totalCost.usd > 0) {
      summary += ` · $${options.totalCost.usd.toFixed(4)}`;
    }
    if (options?.confidenceFloor !== undefined && options.confidenceFloor < 1.0) {
      summary += ` · confidence floor: ${(options.confidenceFloor * 100).toFixed(0)}%`;
    }
    summary += `\n`;
    parts.push(summary);

    // --- Impact section (when available) ---
    if (options?.impact?.length) {
      let impactMd = `\n### 🎯 Impact Analysis\n\n`;
      impactMd += `Ran **${options.impact.length}** spec(s) based on diff analysis:\n\n`;
      for (const item of options.impact) {
        const matchIcon = item.matchedBy === "path" ? "📁" : item.matchedBy === "semantic" ? "🧠" : "📁🧠";
        impactMd += `- ${matchIcon} **${item.spec}** (score: ${item.score.toFixed(2)}) — ${item.reasons.join(", ")}\n`;
      }
      impactMd += `\n`;
      parts.push(impactMd);
    }

    // --- Failures section ---
    const failedResults = results.filter(r => r.status !== "pass");
    if (failedResults.length > 0) {
      let failMd = `### ❌ Failures\n\n`;
      for (const result of failedResults) {
        for (const scenario of result.scenarios) {
          if (scenario.status === "pass") continue;
          const duration = (scenario.duration_ms / 1000).toFixed(1);
          const scenarioEmoji = scenario.status === "error" ? "⚠️" : "❌";
          failMd += `<details><summary>${scenarioEmoji} <strong>${result.spec}</strong> → ${scenario.scenario} (${duration}s)</summary>\n\n`;

          for (const exp of scenario.expectations) {
            if (exp.status === "fail") {
              failMd += `> **Expected:** ${exp.text}\n`;
              if (exp.evidence) failMd += `> **Got:** ${exp.evidence}\n`;
              if (exp.reasoning) failMd += `> **Why:** ${exp.reasoning}\n`;
              if (exp.confidence !== undefined) {
                failMd += `> **Confidence:** ${(exp.confidence * 100).toFixed(0)}%`;
                if (exp.low_confidence) failMd += ` ⚠️ below threshold`;
                failMd += `\n`;
              }
            }
          }

          if (scenario.error) {
            failMd += `> **Error:** ${scenario.error}\n`;
          }

          if (scenario.screenshots?.length) {
            failMd += `\n**Screenshots:**\n`;
            for (const s of scenario.screenshots) {
              failMd += `- \`${s}\`\n`;
            }
          }

          // Proposed fix section
          if (scenario.proposedFix) {
            failMd += `\n**🔧 Proposed Fix** (confidence: ${(scenario.proposedFix.confidence * 100).toFixed(0)}%)`;
            if (scenario.proposedFix.oversized) failMd += ` ⚠️ oversized — manual review required`;
            failMd += `\n\n`;
            failMd += `> ${scenario.proposedFix.summary}\n\n`;
            for (const file of scenario.proposedFix.files) {
              failMd += `\`${file.path}\`:\n`;
              failMd += "```diff\n" + file.diff + "\n```\n";
              if (file.rationale) failMd += `> ${file.rationale}\n`;
              failMd += `\n`;
            }
          }

          failMd += `</details>\n\n`;
        }
      }
      parts.push(failMd);
    }

    // --- Passed section (collapsed) ---
    const passedResults = results.filter(r => r.status === "pass");
    if (passedResults.length > 0) {
      let passMd = `<details><summary>✅ <strong>${passedScenarios} passed</strong></summary>\n\n`;
      for (const result of passedResults) {
        passMd += `**${result.spec}**\n`;
        for (const scenario of result.scenarios) {
          const duration = (scenario.duration_ms / 1000).toFixed(1);
          let tags = "";
          if (scenario.flaky) tags += ` 🟡 flaky (${(scenario.flaky.rate * 100).toFixed(0)}%)`;
          if (scenario.perf_regression) tags += ` ⚠️ ${scenario.perf_regression.ratio.toFixed(1)}× slower`;
          passMd += `- ✅ ${scenario.scenario} (${duration}s)${tags}\n`;
        }
        passMd += `\n`;
      }
      passMd += `</details>\n\n`;
      parts.push(passMd);
    }

    // --- Footer ---
    let footer = `---\n`;
    footer += `✅ ${passedScenarios} passed  ❌ ${failedScenarios} failed  `;
    footer += `(${(totalDuration / 1000).toFixed(1)}s)`;
    if (options?.totalCost && options.totalCost.usd > 0) {
      footer += `  💰 $${options.totalCost.usd.toFixed(4)}`;
    }
    footer += `\n`;

    if (options?.artifactUrl) {
      footer += `\n[View screenshots and artifacts](${options.artifactUrl})\n`;
    }

    parts.push(footer);

    // Truncate if too large for GitHub (65k char limit)
    const joined = parts.join("");
    if (joined.length > 60000) {
      const truncated = joined.substring(0, 59000);
      return truncated + "\n\n> ⚠️ Report truncated — view full results in artifacts.\n";
    }

    return joined;
  }

  generateSummary(results: SpecResult[]): { passed: number; failed: number; errors: number; total: number } {
    const totalScenarios = results.reduce((sum, r) => sum + r.scenarios.length, 0);
    const passedScenarios = results.reduce(
      (sum, r) => sum + r.scenarios.filter(s => s.status === "pass").length,
      0
    );
    const errorScenarios = results.reduce(
      (sum, r) => sum + r.scenarios.filter(s => s.status === "error").length,
      0
    );

    return {
      passed: passedScenarios,
      failed: totalScenarios - passedScenarios,
      errors: errorScenarios,
      total: totalScenarios,
    };
  }

  generateJUnit(results: SpecResult[]): string {
    const totalScenarios = results.reduce((sum, r) => sum + r.scenarios.length, 0);
    const failedScenarios = results.reduce(
      (sum, r) => sum + r.scenarios.filter(s => s.status !== "pass").length,
      0
    );
    const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0) / 1000;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuites tests="${totalScenarios}" failures="${failedScenarios}" time="${totalDuration.toFixed(3)}">\n`;

    for (const result of results) {
      const specFailed = result.scenarios.filter(s => s.status !== "pass").length;
      const specDuration = result.duration_ms / 1000;

      xml += `  <testsuite name="${escapeXml(result.spec)}" tests="${result.scenarios.length}" failures="${specFailed}" time="${specDuration.toFixed(3)}">\n`;

      for (const scenario of result.scenarios) {
        const scenarioDuration = scenario.duration_ms / 1000;
        xml += `    <testcase name="${escapeXml(scenario.scenario)}" classname="${escapeXml(result.spec)}" time="${scenarioDuration.toFixed(3)}"`;

        if (scenario.status === "pass") {
          xml += ` />\n`;
        } else {
          xml += `>\n`;
          if (scenario.status === "error") {
            xml += `      <error message="${escapeXml(scenario.error ?? "Unknown error")}">\n`;
            xml += `${escapeXml(scenario.error ?? "")}\n`;
            xml += `      </error>\n`;
          } else {
            const failedExps = scenario.expectations.filter(e => e.status === "fail");
            const message = failedExps.map(e => e.text).join("; ");
            const detail = failedExps.map(e => `Expected: ${e.text}\nGot: ${e.evidence ?? "N/A"}\nReason: ${e.reasoning ?? "N/A"}`).join("\n\n");
            xml += `      <failure message="${escapeXml(message)}">\n`;
            xml += `${escapeXml(detail)}\n`;
            xml += `      </failure>\n`;
          }
          xml += `    </testcase>\n`;
        }
      }

      xml += `  </testsuite>\n`;
    }

    xml += `</testsuites>\n`;
    return xml;
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
