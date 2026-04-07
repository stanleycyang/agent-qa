import Anthropic from "@anthropic-ai/sdk";
import { Scenario } from "@agentqa/core";
import { LogicAgent } from "./logic-agent.js";
/**
 * Security audit agent. Extends LogicAgent with OWASP-aware system prompts
 * and additional pattern-matching tools. Useful for catching common
 * vulnerabilities in code review (no runtime testing).
 */
export declare class SecurityAgent extends LogicAgent {
    getTools(): Anthropic.Tool[];
    handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
    private scanForSecrets;
    buildSystemPrompt(_scenario: Scenario): string;
}
//# sourceMappingURL=security-agent.d.ts.map