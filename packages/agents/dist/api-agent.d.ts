import Anthropic from "@anthropic-ai/sdk";
import { Scenario } from "@agentqa/core";
import { BaseAgent } from "./base-agent.js";
export declare class APIAgent extends BaseAgent {
    private http;
    private assertions;
    constructor(model?: string);
    getTools(): Anthropic.Tool[];
    handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
    buildSystemPrompt(scenario: Scenario): string;
}
//# sourceMappingURL=api-agent.d.ts.map