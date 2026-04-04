import { ExecutionPlan, SpecResult, AgentQAConfig } from "./types.js";
export declare class Orchestrator {
    private configPath;
    private rootDir;
    private config;
    private specsDir;
    constructor(configPath: string, rootDir?: string);
    initialize(): Promise<void>;
    buildPlan(changedFiles?: string[]): Promise<ExecutionPlan>;
    execute(plan: ExecutionPlan): Promise<SpecResult[]>;
    getConfig(): AgentQAConfig;
}
//# sourceMappingURL=orchestrator.d.ts.map