import Anthropic from "@anthropic-ai/sdk";
import { Scenario } from "@agentqa/core";
import { BaseAgent } from "./base-agent.js";
/**
 * Generates AgentQA YAML specs from various inputs (git diff, Figma, Sentry, Linear/Jira).
 * Unlike test-execution agents, this agent does NOT run a scenario — it produces specs.
 * The caller invokes generateFromContext() with a context payload, and the agent
 * outputs YAML blocks that can be written to disk.
 */
export declare class SpecGeneratorAgent extends BaseAgent {
    private fs;
    private git;
    constructor(model?: string);
    getTools(): Anthropic.Tool[];
    handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
    buildSystemPrompt(_scenario: Scenario): string;
    /**
     * Generate one or more spec YAML blocks from a context payload.
     * Returns the raw agent output text containing fenced YAML blocks.
     */
    generateFromContext(context: string): Promise<string>;
}
//# sourceMappingURL=spec-generator-agent.d.ts.map