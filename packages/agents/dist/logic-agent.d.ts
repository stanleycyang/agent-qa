import Anthropic from "@anthropic-ai/sdk";
import { Scenario } from "@agentqa/core";
import { BaseAgent } from "./base-agent.js";
export declare class LogicAgent extends BaseAgent {
    private fs;
    private git;
    constructor(model?: string);
    getTools(): Anthropic.Tool[];
    handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
    private grepDirectory;
    buildSystemPrompt(scenario: Scenario): string;
}
//# sourceMappingURL=logic-agent.d.ts.map