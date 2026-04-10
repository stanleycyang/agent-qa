import { SpecResult } from "@agentqa/core";
export interface ReportOptions {
    artifactUrl?: string;
    impact?: Array<{
        spec: string;
        score: number;
        reasons: string[];
        matchedBy: string;
    }>;
    totalCost?: {
        input_tokens: number;
        output_tokens: number;
        usd: number;
    };
    confidenceFloor?: number;
}
export declare class ReporterAgent {
    generateMarkdown(results: SpecResult[], options?: ReportOptions): string;
    generateSummary(results: SpecResult[]): {
        passed: number;
        failed: number;
        errors: number;
        total: number;
    };
    generateJUnit(results: SpecResult[]): string;
}
//# sourceMappingURL=reporter-agent.d.ts.map