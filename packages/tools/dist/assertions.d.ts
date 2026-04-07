export interface AssertionResult {
    pass: boolean;
    confidence: number;
    reasoning: string;
}
export interface VisualComparisonResult extends AssertionResult {
    differences?: string[];
}
export interface VisualIssue {
    severity: "critical" | "warning" | "info";
    category: "layout" | "overflow" | "broken_image" | "missing_element" | "accessibility" | "other";
    description: string;
    location?: string;
}
export declare class AssertionEngine {
    private client;
    constructor();
    assertText(text: string, expectation: string, model?: string): Promise<AssertionResult>;
    assertScreenshot(screenshotBase64: string, expectation: string, model?: string): Promise<AssertionResult>;
    /**
     * Compare a current screenshot against a baseline image and detect visual regressions.
     * Uses a vision LLM to identify meaningful differences (not pixel-level noise).
     */
    compareScreenshots(currentBase64: string, baselineBase64: string, context?: string, model?: string): Promise<VisualComparisonResult>;
    /**
     * Proactively scan a screenshot for visual breakages without a baseline.
     * Detects things a human reviewer would flag: layout bugs, broken images,
     * text overflow, misaligned elements, accessibility issues.
     */
    detectVisualIssues(screenshotBase64: string, context?: string, model?: string): Promise<{
        issues: VisualIssue[];
        overall_health: "healthy" | "issues_found" | "broken";
    }>;
}
//# sourceMappingURL=assertions.d.ts.map