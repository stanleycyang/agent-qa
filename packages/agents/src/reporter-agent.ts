import { SpecResult } from "@agentqa/core";

export class ReporterAgent {
  generateMarkdown(results: SpecResult[]): string {
    const totalScenarios = results.reduce((sum, r) => sum + r.scenarios.length, 0);
    const passedScenarios = results.reduce(
      (sum, r) => sum + r.scenarios.filter(s => s.status === "pass").length,
      0
    );
    const failedScenarios = totalScenarios - passedScenarios;
    
    const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);
    
    let markdown = `## 🤖 AgentQA Results\n\n`;
    markdown += `**${results.length} specs evaluated · ${totalScenarios} scenarios · `;
    markdown += `${passedScenarios} passed · ${failedScenarios} failed**\n\n`;
    
    for (const result of results) {
      const specPassed = result.scenarios.filter(s => s.status === "pass").length;
      const specTotal = result.scenarios.length;
      const emoji = result.status === "pass" ? "✅" : "❌";
      
      markdown += `### ${emoji} ${result.spec} (${specPassed}/${specTotal} passed)\n\n`;
      
      for (const scenario of result.scenarios) {
        const scenarioEmoji = scenario.status === "pass" ? "✅" : "❌";
        markdown += `- ${scenarioEmoji} ${scenario.scenario}\n`;
        
        if (scenario.status === "fail" || scenario.status === "error") {
          for (const expectation of scenario.expectations) {
            if (expectation.status === "fail") {
              markdown += `  > **Expected:** ${expectation.text}\n`;
              if (expectation.evidence) {
                markdown += `  > **Got:** ${expectation.evidence}\n`;
              }
              if (expectation.reasoning) {
                markdown += `  > ${expectation.reasoning}\n`;
              }
            }
          }
          if (scenario.error) {
            markdown += `  > **Error:** ${scenario.error}\n`;
          }
        }
      }
      
      markdown += `\n`;
    }
    
    markdown += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    markdown += `✅ ${passedScenarios} passed  ❌ ${failedScenarios} failed  `;
    markdown += `(total: ${(totalDuration / 1000).toFixed(1)}s)\n`;
    
    return markdown;
  }
  
  generateSummary(results: SpecResult[]): { passed: number; failed: number; total: number } {
    const totalScenarios = results.reduce((sum, r) => sum + r.scenarios.length, 0);
    const passedScenarios = results.reduce(
      (sum, r) => sum + r.scenarios.filter(s => s.status === "pass").length,
      0
    );
    
    return {
      passed: passedScenarios,
      failed: totalScenarios - passedScenarios,
      total: totalScenarios
    };
  }
}
