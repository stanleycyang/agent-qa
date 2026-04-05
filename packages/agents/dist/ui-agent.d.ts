import Anthropic from "@anthropic-ai/sdk";
import { Scenario } from "@agentqa/core";
import { BaseAgent } from "./base-agent.js";
export declare class UIAgent extends BaseAgent {
    private browser;
    private assertions;
    constructor(model?: string);
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    captureScreenshot(savePath: string): Promise<string>;
    getTools(): Anthropic.Tool[];
    handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
    buildSystemPrompt(scenario: Scenario): string;
}
//# sourceMappingURL=ui-agent.d.ts.map