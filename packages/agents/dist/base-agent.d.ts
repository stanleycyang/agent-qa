import Anthropic from "@anthropic-ai/sdk";
import { ToolCall, ScenarioResult, Scenario, TokenUsage } from "@agentqa/core";
export declare abstract class BaseAgent {
    protected client: Anthropic;
    protected model: string;
    protected toolCalls: ToolCall[];
    protected allowWrites: boolean;
    protected writeRoot: string;
    protected tokenUsage: TokenUsage;
    constructor(model?: string);
    /** Get accumulated token usage and reset the counter. */
    getAndResetUsage(): TokenUsage;
    /** Enable file writes from within the agent loop. Used by fix-agent and auto-heal. */
    enableWrites(rootDir?: string): void;
    /** Built-in write_file tool exposed when allowWrites is true. */
    protected getWriteTools(): Anthropic.Tool[];
    protected handleWriteTool(name: string, input: Record<string, unknown>): Promise<unknown>;
    abstract getTools(): Anthropic.Tool[];
    abstract handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
    abstract buildSystemPrompt(scenario: Scenario): string;
    /**
     * Drive a conversation loop with the model: send the prompt, handle any
     * tool calls (including the built-in write_file when allowed), and return
     * the final assistant text. Used by both `runScenario` and free-form
     * tasks like spec generation and fix proposal.
     */
    protected runConversation(systemPrompt: string, initialUserMessage: string, options?: {
        maxToolResultBytes?: number;
    }): Promise<string>;
    runScenario(scenario: Scenario, environment: Record<string, string>): Promise<ScenarioResult>;
    private buildUserPrompt;
    protected parseResult(scenario: Scenario, finalText: string, startTime: number): ScenarioResult;
}
//# sourceMappingURL=base-agent.d.ts.map