import { SpecResult, ScenarioResult } from "@agentqa/core";

export class ReporterAgent {
  generateMarkdown(results: SpecResult[], options?: { artifactUrl?: string }): string {
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

    let markdown = `## 🤖 AgentQA Results ${statusEmoji}\n\n`;
    markdown += `**${results.length} specs · ${totalScenarios} scenarios · `;
    markdown += `${passedScenarios} passed · ${failedScenarios} failed`;
    if (errorScenarios > 0) markdown += ` · ${errorScenarios} errors`;
    markdown += `** (${(totalDuration / 1000).toFixed(1)}s)\n\n`;

    for (const result of results) {
      const specPassed = result.scenarios.filter(s => s.status === "pass").length;
      const specTotal = result.scenarios.length;
      const emoji = result.status === "pass" ? "✅" : "❌";

      markdown += `### ${emoji} ${result.spec} (${specPassed}/${specTotal} passed)\n\n`;

      for (const scenario of result.scenarios) {
        const scenarioEmoji = scenario.status === "pass" ? "✅" : scenario.status === "error" ? "⚠️" : "❌";
        const duration = (scenario.duration_ms / 1000).toFixed(1);
        markdown += `- ${scenarioEmoji} ${scenario.scenario} (${duration}s)\n`;

        if (scenario.status === "fail" || scenario.status === "error") {
          // Use collapsible details for failed scenarios
          markdown += `  <details><summary>Details</summary>\n\n`;

          for (const expectation of scenario.expectations) {
            if (expectation.status === "fail") {
              markdown += `  > **Expected:** ${expectation.text}\n`;
              if (expectation.evidence) {
                markdown += `  > **Got:** ${expectation.evidence}\n`;
              }
              if (expectation.reasoning) {
                markdown += `  > **Why:** ${expectation.reasoning}\n`;
              }
              if (expectation.confidence !== undefined) {
                markdown += `  > **Confidence:** ${(expectation.confidence * 100).toFixed(0)}%\n`;
              }
            }
          }
          if (scenario.error) {
            markdown += `  > **Error:** ${scenario.error}\n`;
          }
          if (scenario.screenshots?.length) {
            markdown += `  > **Screenshots:** ${scenario.screenshots.map(s => `\`${s}\``).join(", ")}\n`;
          }

          markdown += `  </details>\n`;
        }
      }

      markdown += `\n`;
    }

    markdown += `---\n`;
    markdown += `✅ ${passedScenarios} passed  ❌ ${failedScenarios} failed  `;
    markdown += `(${(totalDuration / 1000).toFixed(1)}s)\n`;

    if (options?.artifactUrl) {
      markdown += `\n[View screenshots and artifacts](${options.artifactUrl})\n`;
    }

    return markdown;
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
