import Anthropic from "@anthropic-ai/sdk";
import { Scenario } from "@agentqa/core";
import { FilesystemTool, GitTool } from "@agentqa/tools";
import { BaseAgent } from "./base-agent.js";

/**
 * Generates AgentQA YAML specs from various inputs (git diff, Figma, Sentry, Linear/Jira).
 * Unlike test-execution agents, this agent does NOT run a scenario — it produces specs.
 * The caller invokes generateFromContext() with a context payload, and the agent
 * outputs YAML blocks that can be written to disk.
 */
export class SpecGeneratorAgent extends BaseAgent {
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
        description: "Read a file to understand its purpose and behavior.",
        input_schema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
      {
        name: "list_dir",
        description: "List files in a directory.",
        input_schema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
      {
        name: "git_diff",
        description: "Get the git diff between two refs (or unstaged changes).",
        input_schema: {
          type: "object",
          properties: {
            ref1: { type: "string" },
            ref2: { type: "string" },
          },
          required: [],
        },
      },
      {
        name: "list_changed_files",
        description: "List files that changed between two git refs.",
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
      case "git_diff":
        return this.git.getDiff(input.ref1 as string, input.ref2 as string);
      case "list_changed_files":
        return this.git.listChangedFiles(input.ref1 as string, input.ref2 as string);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  buildSystemPrompt(_scenario: Scenario): string {
    return SPEC_GENERATOR_PROMPT;
  }

  /**
   * Generate one or more spec YAML blocks from a context payload.
   * Returns the raw agent output text containing fenced YAML blocks.
   */
  async generateFromContext(context: string): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: context },
    ];

    while (true) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SPEC_GENERATOR_PROMPT,
        tools: this.getTools(),
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
          const output = await this.handleToolCall(
            toolUse.name,
            toolUse.input as Record<string, unknown>
          );
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

const SPEC_GENERATOR_PROMPT = `You are a senior QA engineer who writes AgentQA test specs.

AgentQA specs are YAML files describing tests in plain English. Your job is to read a code change, design, error, or user story, and produce specs that would catch regressions in the described behavior.

## Spec format
\`\`\`yaml
name: Descriptive name of the feature
description: One-line summary
trigger:
  paths:
    - "src/path/that/should/trigger/this/spec/**"
environment:
  type: web | api | logic
  base_url: "http://localhost:3000"  # for web
scenarios:
  - name: "Specific scenario name"
    steps:
      - "Plain English step 1"
      - "Plain English step 2"
    expect:
      - "Plain English expectation 1"
      - "Plain English expectation 2"
    on_failure: screenshot
\`\`\`

## Environment types
- **web**: Browser UI testing (Playwright + vision). Use for user flows, visual checks, form interactions
- **api**: HTTP API testing. Use for endpoint behavior, response validation
- **logic**: Static code review. Use for security checks, code quality invariants

## Quality guidelines
1. **Be specific**: "Submit the order with test card 4242424242424242" not "Submit the form"
2. **Test happy AND sad paths**: For new features, generate at least 1 success and 1 failure scenario
3. **Verify with concrete evidence**: Expectations should be checkable ("error message contains 'invalid card'") not vague ("user gets feedback")
4. **One feature per spec**: Group related scenarios together; don't dump everything into one file
5. **Use trigger paths**: Match the changed files so the spec only runs when relevant
6. **Visual checks for UI**: For web specs, include "no visual regressions" and "no broken layout" expectations to leverage the framework's vision capabilities

## Output format
After exploring the context with the available tools (read_file, git_diff, etc.), output one or more YAML specs as fenced code blocks:

\`\`\`yaml
name: ...
...
\`\`\`

\`\`\`yaml
name: ...
...
\`\`\`

Then briefly explain what each spec covers.`;
