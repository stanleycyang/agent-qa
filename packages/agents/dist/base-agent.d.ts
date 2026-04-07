import Anthropic from "@anthropic-ai/sdk";
import { ToolCall, ScenarioResult, Scenario } from "@agentqa/core";
export declare abstract class BaseAgent {
    protected client: Anthropic;
    protected model: string;
    protected toolCalls: ToolCall[];
    protected allowWrites: boolean;
    protected writeRoot: string;
    constructor(model?: string);
    /** Enable file writes from within the agent loop. Used by fix-agent and auto-heal. */
    enableWrites(rootDir?: string): void;
    /** Built-in write_file tool exposed when allowWrites is true. */
    protected getWriteTools(): Anthropic.Tool[];
    protected handleWriteTool(name: string, input: Record<string, unknown>): Promise<unknown>;
    abstract getTools(): Anthropic.Tool[];
    abstract handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
    abstract buildSystemPrompt(scenario: Scenario): string;
    runScenario(scenario: Scenario, environment: Record<string, string>): Promise<ScenarioResult>;
    private buildUserPrompt;
    protected parseResult(scenario: Scenario, finalText: string, startTime: number): ScenarioResult;
}
//# sourceMappingURL=base-agent.d.ts.map