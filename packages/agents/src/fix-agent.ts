import Anthropic from "@anthropic-ai/sdk";
import { Scenario, ScenarioResult } from "@agentqa/core";
import { FilesystemTool, GitTool } from "@agentqa/tools";
import { BaseAgent } from "./base-agent.js";

/**
 * Reads a failing scenario result and proposes a code fix.
 * Has access to filesystem + git tools and (when enableWrites is set) write_file.
 */
export class FixAgent extends BaseAgent {
  private fs: FilesystemTool;
  private git: GitTool;

  constructor(model?: string) {
    super(model);
    this.fs = new FilesystemTool();
    this.git = new GitTool();
  }

  getTools(): Anthropic.Tool[] {
    return [
      {
        name: "read_file",
        description: "Read a file to understand its current implementation.",
        input_schema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
      {
        name: "list_dir",
        description: "List files in a directory to discover related code.",
        input_schema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
      {
        name: "grep_file",
        description: "Search for a regex pattern in a file.",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string" },
            pattern: { type: "string" },
          },
          required: ["path", "pattern"],
        },
      },
      {
        name: "git_diff",
        description: "Get the git diff to see what changed recently.",
        input_schema: {
          type: "object",
          properties: {
            ref1: { type: "string" },
            ref2: { type: "string" },
          },
          required: [],
        },
      },
    ];
  }

  async handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case "read_file":
        return this.fs.readFile(input.path as string);
      case "list_dir":
        return this.fs.listDir(input.path as string);
      case "grep_file":
        return this.fs.grepFile(input.path as string, input.pattern as string);
      case "git_diff":
        return this.git.getDiff(input.ref1 as string, input.ref2 as string);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  buildSystemPrompt(_scenario: Scenario): string {
    const writeNote = this.allowWrites
      ? "\n\nYou have access to the write_file tool — use it to apply fixes directly. Always read the file first, then write the full updated content."
      : "\n\nYou cannot write files directly. Output the proposed fix as a unified diff in a fenced code block.";
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
After investigating, output your analysis followed by the fix:

1. **Root cause**: 1-2 sentences explaining what's broken
2. **Fix**: the actual code change${writeNote}

If you can't determine a fix with confidence, explain what you found and what additional context you'd need.`;
  }

  /**
   * Investigate a failing scenario and propose (or apply) a fix.
   */
  async fixFailure(spec: string, result: ScenarioResult): Promise<string> {
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

Investigate the codebase and propose a fix.`;

    const messages: Anthropic.MessageParam[] = [{ role: "user", content: context }];

    while (true) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: this.buildSystemPrompt({} as Scenario),
        tools: [...this.getTools(), ...this.getWriteTools()],
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        return response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map(b => b.text)
          .join("\n");
      }

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
        );
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUseBlocks) {
          let output: unknown;
          if (toolUse.name === "write_file") {
            output = await this.handleWriteTool(toolUse.name, toolUse.input as Record<string, unknown>);
          } else {
            output = await this.handleToolCall(toolUse.name, toolUse.input as Record<string, unknown>);
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(output).substring(0, 8000),
          });
        }
        messages.push({ role: "user", content: toolResults });
      }
    }
  }
}
