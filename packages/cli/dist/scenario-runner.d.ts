import { AgentQASpec, Scenario, ScenarioResult, ViewportConfig, BrowserType } from "@agentqa/core";
import { BaselineStore } from "@agentqa/tools";
export interface ExecuteScenarioOptions {
    agentModel: string;
    rootDir: string;
    baselineStore: BaselineStore;
    updateBaselines?: boolean;
    screenshotOnFailure?: boolean;
    recordVideoOnFailure?: boolean;
    matrixViewport?: ViewportConfig;
    matrixBrowser?: BrowserType;
}
/**
 * Run a single scenario against the appropriate agent for its environment type.
 * Used by `agentqa run`, `agentqa fix`, and `agentqa bisect`.
 */
export declare function executeScenario(spec: AgentQASpec, scenario: Scenario, envVars: Record<string, string>, options: ExecuteScenarioOptions): Promise<ScenarioResult>;
/** Substitute {{ENV_VAR}} placeholders with values from process.env. */
export declare function resolveEnv(value?: string): string | undefined;
//# sourceMappingURL=scenario-runner.d.ts.map