import { loadAllSpecs, parseConfig } from "./spec-parser.js";
import { analyzeChangedFiles } from "./diff-analyzer.js";
import { buildExecutionPlan } from "./plan-builder.js";
import * as path from "path";
export class Orchestrator {
    configPath;
    rootDir;
    config;
    specsDir;
    constructor(configPath, rootDir = process.cwd()) {
        this.configPath = configPath;
        this.rootDir = rootDir;
        this.specsDir = path.join(rootDir, ".agentqa", "specs");
    }
    async initialize() {
        this.config = await parseConfig(this.configPath);
    }
    async buildPlan(changedFiles) {
        const allSpecs = await loadAllSpecs(this.specsDir);
        if (!changedFiles || changedFiles.length === 0) {
            // No diff provided, run all specs
            const mapped = allSpecs.map(({ spec, path }) => ({ spec, specPath: path }));
            return buildExecutionPlan(mapped, this.config);
        }
        const analysis = analyzeChangedFiles(changedFiles, allSpecs);
        return buildExecutionPlan(analysis.matchedSpecs, this.config);
    }
    async execute(plan) {
        // Execution is delegated to agents in the next package
        // This is the orchestration layer only
        return [];
    }
    getConfig() {
        return this.config;
    }
}
//# sourceMappingURL=orchestrator.js.map