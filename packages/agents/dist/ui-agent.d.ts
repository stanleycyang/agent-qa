import Anthropic from "@anthropic-ai/sdk";
import { Scenario } from "@agentqa/core";
import { BaselineStore } from "@agentqa/tools";
import { BaseAgent } from "./base-agent.js";
export interface UIAgentOptions {
    model?: string;
    baselineStore?: BaselineStore;
    specName?: string;
    updateBaselines?: boolean;
}
export declare class UIAgent extends BaseAgent {
    private browser;
    private assertions;
    private baselineStore?;
    private specName?;
    private updateBaselines;
    private currentScenarioName;
    constructor(modelOrOptions?: string | UIAgentOptions);
    runScenario(scenario: Scenario, environment: Record<string, string>): Promise<import("@agentqa/core").ScenarioResult>;
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    captureScreenshot(savePath: string): Promise<string>;
    getTools(): Anthropic.Tool[];
    handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
    buildSystemPrompt(scenario: Scenario): string;
}
//# sourceMappingURL=ui-agent.d.ts.map