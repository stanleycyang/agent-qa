import Anthropic from "@anthropic-ai/sdk";
import { Scenario, ScenarioResult, ProposedFix } from "@agentqa/core";
import { LogicAgent } from "./logic-agent.js";
export interface FixOptions {
    mode: "propose" | "apply";
    minConfidence: number;
    maxFiles: number;
    maxLines: number;
    rootDir: string;
}
/**
 * Reads a failing scenario result and proposes a code fix.
 * Inherits the full read/grep/git toolset from LogicAgent and adds a
 * `propose_fix` tool for structured output.
 */
export declare class FixAgent extends LogicAgent {
    private fixResult;
    getTools(): Anthropic.Tool[];
    handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
    buildSystemPrompt(_scenario: Scenario): string;
    /**
     * Investigate a failing scenario and return a structured fix proposal.
     */
    fixFailure(spec: string, result: ScenarioResult, opts?: Partial<FixOptions>): Promise<ProposedFix>;
}
//# sourceMappingURL=fix-agent.d.ts.map