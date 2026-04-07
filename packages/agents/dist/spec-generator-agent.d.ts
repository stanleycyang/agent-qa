import { Scenario } from "@agentqa/core";
import { LogicAgent } from "./logic-agent.js";
/**
 * Generates AgentQA YAML specs from various inputs (git diff, Figma, Sentry, Linear/Jira).
 * Inherits the read/grep/git toolset from LogicAgent. Unlike test-execution
 * agents, the caller invokes `generateFromContext()` and gets back the raw
 * agent text containing fenced YAML blocks.
 */
export declare class SpecGeneratorAgent extends LogicAgent {
    buildSystemPrompt(_scenario: Scenario): string;
    generateFromContext(context: string): Promise<string>;
}
//# sourceMappingURL=spec-generator-agent.d.ts.map