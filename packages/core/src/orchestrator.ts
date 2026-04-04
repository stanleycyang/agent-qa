import { loadAllSpecs, parseConfig } from "./spec-parser.js";
import { analyzeChangedFiles } from "./diff-analyzer.js";
import { buildExecutionPlan } from "./plan-builder.js";
import { ExecutionPlan, SpecResult, AgentQAConfig } from "./types.js";
import * as path from "path";

export class Orchestrator {
  private config!: AgentQAConfig;
  private specsDir: string;
  
  constructor(
    private configPath: string,
    private rootDir: string = process.cwd()
  ) {
    this.specsDir = path.join(rootDir, ".agentqa", "specs");
  }
  
  async initialize(): Promise<void> {
    this.config = await parseConfig(this.configPath);
  }
  
  async buildPlan(changedFiles?: string[]): Promise<ExecutionPlan> {
    const allSpecs = await loadAllSpecs(this.specsDir);
    
    if (!changedFiles || changedFiles.length === 0) {
      // No diff provided, run all specs
      const mapped = allSpecs.map(({ spec, path }) => ({ spec, specPath: path }));
      return buildExecutionPlan(mapped, this.config);
    }
    
    const analysis = analyzeChangedFiles(changedFiles, allSpecs);
    return buildExecutionPlan(analysis.matchedSpecs, this.config);
  }
  
  async execute(plan: ExecutionPlan): Promise<SpecResult[]> {
    // Execution is delegated to agents in the next package
    // This is the orchestration layer only
    return [];
  }
  
  getConfig(): AgentQAConfig {
    return this.config;
  }
}
