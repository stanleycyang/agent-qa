import Anthropic from "@anthropic-ai/sdk";
import { Scenario } from "@agentqa/core";
import { LogicAgent } from "./logic-agent.js";
/**
 * Forensic analysis agent for failed scenarios.
 * Extends LogicAgent (read-only) with tools for browsing replay artifacts,
 * screenshots, and network logs.
 */
export declare class ExplainAgent extends LogicAgent {
    private rootDir;
    constructor(model?: string, rootDir?: string);
    getTools(): Anthropic.Tool[];
    handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
    buildSystemPrompt(_scenario: Scenario): string;
    /**
     * Analyze a failure and produce a plain-English explanation.
     */
    explain(context: {
        spec: string;
        scenario: string;
        status: string;
        error?: string;
        timestamp: number;
    }): Promise<string>;
}
//# sourceMappingURL=explain-agent.d.ts.map