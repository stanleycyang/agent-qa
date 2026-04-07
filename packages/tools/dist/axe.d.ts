import { BrowserTool } from "./browser.js";
export interface A11yViolation {
    id: string;
    impact: "critical" | "serious" | "moderate" | "minor";
    description: string;
    help: string;
    helpUrl: string;
    nodes: Array<{
        target: string[];
        html: string;
        failureSummary: string;
    }>;
}
export interface A11yReport {
    violations: A11yViolation[];
    passes: number;
    incomplete: number;
    url: string;
}
/**
 * Inject axe-core into the current page and run an accessibility audit.
 * Returns WCAG violations grouped by severity.
 */
export declare function runAxeAudit(browser: BrowserTool): Promise<A11yReport>;
//# sourceMappingURL=axe.d.ts.map