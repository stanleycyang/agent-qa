import Anthropic from "@anthropic-ai/sdk";
import { ToolCall, ScenarioResult, Scenario } from "@agentqa/core";

export abstract class BaseAgent {
  protected client: Anthropic;
  protected model: string;
  protected toolCalls: ToolCall[] = [];

  constructor(model = "claude-opus-4-5") {
    this.client = new Anthropic();
    this.model = model;
  }

  abstract getTools(): Anthropic.Tool[];
  abstract handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown>;
  abstract buildSystemPrompt(scenario: Scenario): string;

  async runScenario(scenario: Scenario, environment: Record<string, string>): Promise<ScenarioResult> {
    const start = Date.now();
    const messages: Anthropic.MessageParam[] = [];
    
    const userPrompt = this.buildUserPrompt(scenario, environment);
    messages.push({ role: "user", content: userPrompt });
    
    while (true) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: this.buildSystemPrompt(scenario),
        tools: this.getTools(),
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        const finalText = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map(b => b.text)
          .join("\n");
        return this.parseResult(scenario, finalText, start);
      }

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUseBlocks) {
          const output = await this.handleToolCall(
            toolUse.name,
            toolUse.input as Record<string, unknown>
          );
          this.toolCalls.push({
            tool: toolUse.name,
            input: toolUse.input as Record<string, unknown>,
            output,
            timestamp: Date.now(),
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(output),
          });
        }
        messages.push({ role: "user", content: toolResults });
      }
    }
  }

  private buildUserPrompt(scenario: Scenario, environment: Record<string, string>): string {
    const steps = scenario.steps?.join("\n") || scenario.review?.join("\n") || "";
    const expectations = scenario.expect.join("\n");
    return `Execute this test scenario:

Name: ${scenario.name}
Environment: ${JSON.stringify(environment, null, 2)}

Steps:
${steps}

After completing steps, verify these expectations:
${expectations}

Return a JSON result with this structure:
{
  "status": "pass" | "fail" | "error",
  "expectations": [
    { "text": "...", "status": "pass" | "fail", "confidence": 0.0-1.0, "evidence": "..." }
  ],
  "summary": "..."
}`;
  }

  protected parseResult(scenario: Scenario, finalText: string, startTime: number): ScenarioResult {
    try {
      const jsonMatch = finalText.match(/```json\n([\s\S]*?)\n```/) || 
                        finalText.match(/\{[\s\S]*"status"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return {
          scenario: scenario.name,
          status: parsed.status || "error",
          expectations: parsed.expectations || [],
          duration_ms: Date.now() - startTime,
          trace: this.toolCalls,
        };
      }
    } catch {}
    
    return {
      scenario: scenario.name,
      status: "error",
      expectations: scenario.expect.map(e => ({ text: e, status: "skip" as const })),
      duration_ms: Date.now() - startTime,
      error: "Could not parse agent result",
    };
  }
}
