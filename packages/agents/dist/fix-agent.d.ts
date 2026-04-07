import { Scenario, ScenarioResult } from "@agentqa/core";
import { LogicAgent } from "./logic-agent.js";
/**
 * Reads a failing scenario result and proposes a code fix.
 * Inherits the full read/grep/git toolset from LogicAgent and adds the
 * built-in write_file tool when `enableWrites` is set.
 */
export declare class FixAgent extends LogicAgent {
    buildSystemPrompt(_scenario: Scenario): string;
    /**
     * Investigate a failing scenario and propose (or apply) a fix.
     */
    fixFailure(spec: string, result: ScenarioResult): Promise<string>;
}
//# sourceMappingURL=fix-agent.d.ts.map