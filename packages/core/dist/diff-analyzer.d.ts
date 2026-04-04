import { AgentQASpec } from "./types.js";
export interface DiffAnalysisResult {
    changedFiles: string[];
    matchedSpecs: Array<{
        spec: AgentQASpec;
        specPath: string;
    }>;
}
export declare function analyzeChangedFiles(changedFiles: string[], specs: Array<{
    spec: AgentQASpec;
    path: string;
}>): DiffAnalysisResult;
//# sourceMappingURL=diff-analyzer.d.ts.map