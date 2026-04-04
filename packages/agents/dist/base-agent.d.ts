import Anthropic from "@anthropic-ai/sdk";
import { ToolCall, ScenarioResult, Scenario } from "@agentqa/core";
export declare abstract class BaseAgent {
    protected client: Anthropic;
    protected model: string;
    protected toolCalls: ToolCall[];
    constructor(model?: string);
    abstract getTools(): Anthropic.Tool[];
    abstract handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
    abstract buildSystemPrompt(scenario: Scenario): string;
    runScenario(scenario: Scenario, environment: Record<string, string>): Promise<ScenarioResult>;
    private buildUserPrompt;
    protected parseResult(scenario: Scenario, finalText: string, startTime: number): ScenarioResult;
}
//# sourceMappingURL=base-agent.d.ts.map