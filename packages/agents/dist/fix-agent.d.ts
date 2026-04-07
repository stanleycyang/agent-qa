import Anthropic from "@anthropic-ai/sdk";
import { Scenario, ScenarioResult } from "@agentqa/core";
import { BaseAgent } from "./base-agent.js";
/**
 * Reads a failing scenario result and proposes a code fix.
 * Has access to filesystem + git tools and (when enableWrites is set) write_file.
 */
export declare class FixAgent extends BaseAgent {
    private fs;
    private git;
    constructor(model?: string);
    getTools(): Anthropic.Tool[];
    handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
    buildSystemPrompt(_scenario: Scenario): string;
    /**
     * Investigate a failing scenario and propose (or apply) a fix.
     */
    fixFailure(spec: string, result: ScenarioResult): Promise<string>;
}
//# sourceMappingURL=fix-agent.d.ts.map