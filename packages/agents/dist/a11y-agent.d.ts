import Anthropic from "@anthropic-ai/sdk";
import { Scenario } from "@agentqa/core";
import { UIAgent, UIAgentOptions } from "./ui-agent.js";
/**
 * Accessibility testing agent. Extends UIAgent with axe-core integration
 * for WCAG violation detection. Use this when the spec environment.type
 * is "web" and the spec focuses on accessibility (or in addition to
 * functional UI testing).
 */
export declare class A11yAgent extends UIAgent {
    constructor(options?: UIAgentOptions | string);
    getTools(): Anthropic.Tool[];
    handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
    buildSystemPrompt(scenario: Scenario): string;
}
//# sourceMappingURL=a11y-agent.d.ts.map