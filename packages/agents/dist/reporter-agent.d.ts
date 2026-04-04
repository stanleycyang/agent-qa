import { SpecResult } from "@agentqa/core";
export declare class ReporterAgent {
    generateMarkdown(results: SpecResult[]): string;
    generateSummary(results: SpecResult[]): {
        passed: number;
        failed: number;
        total: number;
    };
}
//# sourceMappingURL=reporter-agent.d.ts.map