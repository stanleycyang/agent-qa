import { SpecResult } from "@agentqa/core";
export declare class ReporterAgent {
    generateMarkdown(results: SpecResult[], options?: {
        artifactUrl?: string;
    }): string;
    generateSummary(results: SpecResult[]): {
        passed: number;
        failed: number;
        errors: number;
        total: number;
    };
    generateJUnit(results: SpecResult[]): string;
}
//# sourceMappingURL=reporter-agent.d.ts.map