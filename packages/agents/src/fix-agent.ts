import Anthropic from "@anthropic-ai/sdk";
import { Scenario, ScenarioResult, ProposedFix, ProposedFixFile } from "@agentqa/core";
import { LogicAgent } from "./logic-agent.js";

export interface FixOptions {
  mode: "propose" | "apply";
  minConfidence: number;
  maxFiles: number;
  maxLines: number;
  rootDir: string;
}

const DEFAULT_FIX_OPTIONS: FixOptions = {
  mode: "propose",
  minConfidence: 0.8,
  maxFiles: 3,
  maxLines: 50,
  rootDir: process.cwd(),
};

/**
 * Reads a failing scenario result and proposes a code fix.
 * Inherits the full read/grep/git toolset from LogicAgent and adds a
 * `propose_fix` tool for structured output.
 */
export class FixAgent extends LogicAgent {
  private fixResult: ProposedFix | null = null;

  getTools(): Anthropic.Tool[] {
    return [
      ...super.getTools(),
      {
        name: "propose_fix",
        description: "After investigating the failure, call this tool ONCE with your proposed fix. Include all files that need changes and a unified diff for each.",
        input_schema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "1-2 sentence summary of the root cause and fix" },
            confidence: { type: "number", description: "0.0-1.0 confidence that this fix resolves the failure" },
            files: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  path: { type: "string", description: "File path relative to project root" },
                  diff: { type: "string", description: "Unified diff of the changes (--- a/file ... +++ b/file ...)" },
                  rationale: { type: "string", description: "Why this file needs to change" },
                },
                required: ["path", "diff", "rationale"],
              },
              description: "Files to modify",
            },
          },
          required: ["summary", "confidence", "files"],
        },
      },
    ];
  }

  async handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown> {
    if (name === "propose_fix") {
      const files = (input.files as any[]) ?? [];
      const totalLines = files.reduce((sum: number, f: any) => sum + (f.diff?.split("\n").length ?? 0), 0);

      this.fixResult = {
        summary: (input.summary as string) ?? "",
        confidence: (input.confidence as number) ?? 0,
        files: files.map((f: any) => ({
          path: f.path ?? "",
          diff: f.diff ?? "",
          rationale: f.rationale ?? "",
        })),
        oversized: false,
      };

      return { success: true, message: "Fix proposal recorded." };
    }
    return super.handleToolCall(name, input);
  }

  buildSystemPrompt(_scenario: Scenario): string {
    return `You are a senior engineer fixing a failing AgentQA test.

Your job: read the test failure, investigate the codebase, find the root cause, and propose a fix.

## Investigation approach
1. Read the failing scenario name and expectations to understand what should work
2. Read the agent's evidence (what it actually saw) to understand what went wrong
3. Use the available tools to read related files, search for relevant code, and check recent changes
4. Form a hypothesis about the bug
5. Propose a minimal fix that addresses the root cause

## Quality guidelines
- **Minimal**: only change what's necessary to fix the bug
- **Targeted**: don't refactor unrelated code
- **Correct**: verify the fix matches the expected behavior in the test
- **Safe**: avoid changes that could break other features

## Output
After investigating, you MUST call the propose_fix tool exactly once with your analysis and fix.
Include a unified diff for each file that needs to change.
If you can't determine a fix with confidence, still call propose_fix with confidence: 0.3 and explain what you found.`;
  }

  /**
   * Investigate a failing scenario and return a structured fix proposal.
   */
  async fixFailure(spec: string, result: ScenarioResult, opts?: Partial<FixOptions>): Promise<ProposedFix> {
    const options = { ...DEFAULT_FIX_OPTIONS, ...opts };
    this.toolCalls = [];
    this.fixResult = null;

    // Never enable writes in propose mode
    if (options.mode === "apply") {
      this.enableWrites(options.rootDir);
    }

    const failedExpectations = result.expectations
      .filter(e => e.status === "fail")
      .map(e => `- ${e.text}\n  Got: ${e.evidence ?? "n/a"}\n  Reasoning: ${e.reasoning ?? "n/a"}`)
      .join("\n");

    const traceSummary = (result.trace ?? [])
      .slice(-15)
      .map(t => `${t.tool}(${JSON.stringify(t.input).substring(0, 100)})`)
      .join("\n");

    const context = `A test scenario is failing. Investigate and propose a fix.

Spec: ${spec}
Scenario: ${result.scenario}
Status: ${result.status}
${result.error ? `Error: ${result.error}\n` : ""}

Failed expectations:
${failedExpectations || "(none — scenario errored)"}

Recent agent actions:
${traceSummary}

Investigate the codebase and call propose_fix with your analysis.`;

    await this.runConversation(this.buildSystemPrompt({} as Scenario), context, {
      maxToolResultBytes: 8000,
    });

    // If the model didn't call propose_fix, synthesize from its text output
    if (!this.fixResult) {
      this.fixResult = {
        summary: "Agent did not produce a structured fix proposal.",
        confidence: 0.3,
        files: [],
        oversized: false,
      };
    }

    // Validate against limits
    if (this.fixResult.files.length > options.maxFiles) {
      this.fixResult.oversized = true;
    }
    const totalLines = this.fixResult.files.reduce((sum, f) => sum + f.diff.split("\n").length, 0);
    if (totalLines > options.maxLines) {
      this.fixResult.oversized = true;
    }

    return this.fixResult;
  }
}
