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
    /** Track auto-heal events so the CLI can surface suggestions to the user. */
    private healEvents;
    getHealEvents(): typeof this.healEvents;
    /**
     * Click with auto-heal: if the click fails, take a screenshot, ask the
     * vision model where the intended element is, and retry once with the new selector.
     */
    private clickWithHeal;
    private typeWithHeal;
    private healSelector;
    getTools(): Anthropic.Tool[];
    handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
    buildSystemPrompt(scenario: Scenario): string;
}
//# sourceMappingURL=ui-agent.d.ts.map