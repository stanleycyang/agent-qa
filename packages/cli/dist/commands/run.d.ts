import { SpecResult, AgentQASpec } from "@agentqa/core";
import { BaselineStore, HistoryStore } from "@agentqa/tools";
import { loadConfig } from "../config.js";
export interface RunOptions {
    dir?: string;
    verbose?: boolean;
    json?: boolean;
    dryRun?: boolean;
    watch?: boolean;
    updateBaselines?: boolean;
    autoFix?: boolean;
}
export { runSpecsFiltered, RunConfig };
export declare function runCommand(specName?: string, rootDir?: string, options?: RunOptions): Promise<void>;
interface RunConfig {
    timeoutMs: number;
    maxRetries: number;
    screenshotOnFailure: boolean;
    agentModel: string;
    rootDir: string;
    concurrency: number;
    verbose: boolean;
    json: boolean;
    baselineStore: BaselineStore;
    historyStore: HistoryStore;
    perfThreshold: number;
    flakyThreshold: number;
    updateBaselines: boolean;
    recordVideoOnFailure: boolean;
    autoFix: boolean;
    autoFixMode: "propose" | "apply";
    autoFixMinConfidence: number;
    autoFixMaxFiles: number;
    autoFixMaxLines: number;
}
/**
 * Public entry point for running a pre-filtered set of specs.
 * Used by `agentqa impact` and `agentqa run` to share the same execution pipeline.
 */
declare function runSpecsFiltered(specEntries: Array<{
    spec: AgentQASpec;
    path: string;
}>, rootDir: string, options: RunOptions, config: Awaited<ReturnType<typeof loadConfig>>): Promise<{
    results: SpecResult[];
    costInfo: {
        input_tokens: number;
        output_tokens: number;
        usd: number;
    };
    confidenceFloor: number;
}>;
//# sourceMappingURL=run.d.ts.map