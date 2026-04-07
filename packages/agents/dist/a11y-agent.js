import { runAxeAudit } from "@agentqa/tools";
import { UIAgent } from "./ui-agent.js";
/**
 * Accessibility testing agent. Extends UIAgent with axe-core integration
 * for WCAG violation detection. Use this when the spec environment.type
 * is "web" and the spec focuses on accessibility (or in addition to
 * functional UI testing).
 */
export class A11yAgent extends UIAgent {
    constructor(options) {
        super(options);
    }
    getTools() {
        return [
            ...super.getTools(),
            {
                name: "run_axe_audit",
                description: "Run an accessibility audit on the current page using axe-core. Returns WCAG violations grouped by severity (critical, serious, moderate, minor) along with the affected elements and how to fix them. Use this on every important page to verify accessibility compliance.",
                input_schema: {
                    type: "object",
                    properties: {},
                    required: [],
                },
            },
        ];
    }
    async handleToolCall(name, input) {
        if (name === "run_axe_audit") {
            try {
                const report = await runAxeAudit(this.getBrowser());
                return {
                    critical: report.violations.filter(v => v.impact === "critical"),
                    serious: report.violations.filter(v => v.impact === "serious"),
                    moderate: report.violations.filter(v => v.impact === "moderate"),
                    minor: report.violations.filter(v => v.impact === "minor"),
                    totals: {
                        critical: report.violations.filter(v => v.impact === "critical").length,
                        serious: report.violations.filter(v => v.impact === "serious").length,
                        moderate: report.violations.filter(v => v.impact === "moderate").length,
                        minor: report.violations.filter(v => v.impact === "minor").length,
                        passes: report.passes,
                    },
                    url: report.url,
                };
            }
            catch (err) {
                return { error: err.message, success: false };
            }
        }
        return super.handleToolCall(name, input);
    }
    buildSystemPrompt(scenario) {
        return `You are an accessibility QA agent that verifies WCAG compliance on web pages.

## Your approach
1. Navigate to each page involved in the scenario
2. Run run_axe_audit on every important page state (after navigation, after key interactions)
3. Verify each expectation against the audit results
4. Report critical/serious violations as failures, moderate/minor as warnings

## What counts as a failure
- Any **critical** violation (e.g. missing alt text on informative images, no keyboard access)
- Any **serious** violation (e.g. insufficient color contrast, missing form labels)
- The user's specific expectation not met (e.g. "all images have alt text")

## What counts as a warning (not failure)
- **Moderate** and **minor** violations unless the spec explicitly requires WCAG AA/AAA compliance
- Issues that axe flags as "needs review" (manual verification required)

## Common WCAG categories to check
- Color contrast (WCAG 1.4.3)
- Alt text on images (WCAG 1.1.1)
- Keyboard navigation (WCAG 2.1.1)
- Focus indicators (WCAG 2.4.7)
- Heading hierarchy (WCAG 1.3.1)
- ARIA labels and roles (WCAG 4.1.2)
- Form input labels (WCAG 3.3.2)

## Output format
Return your result as a JSON code block:
\`\`\`json
{
  "status": "pass" | "fail" | "error",
  "expectations": [
    { "text": "...", "status": "pass" | "fail", "confidence": 0.95, "evidence": "axe found N critical, N serious violations on page X", "reasoning": "..." }
  ],
  "summary": "..."
}
\`\`\``;
    }
}
//# sourceMappingURL=a11y-agent.js.map