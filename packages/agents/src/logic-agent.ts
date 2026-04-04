import Anthropic from "@anthropic-ai/sdk";
import { Scenario } from "@agentqa/core";
import { FilesystemTool, GitTool } from "@agentqa/tools";
import { BaseAgent } from "./base-agent.js";

export class LogicAgent extends BaseAgent {
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
        description: "Read a file from the filesystem",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to read" }
          },
          required: ["path"]
        }
      },
      {
        name: "list_dir",
        description: "List files in a directory",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path" }
          },
          required: ["path"]
        }
      },
      {
        name: "grep_file",
        description: "Search for a pattern in a file",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string" },
            pattern: { type: "string", description: "Regex pattern" }
          },
          required: ["path", "pattern"]
        }
      },
      {
        name: "git_diff",
        description: "Get git diff between refs",
        input_schema: {
          type: "object",
          properties: {
            ref1: { type: "string" },
            ref2: { type: "string" }
          },
          required: []
        }
      },
      {
        name: "list_changed_files",
        description: "List files changed in a git diff",
        input_schema: {
          type: "object",
          properties: {
            ref1: { type: "string" },
            ref2: { type: "string" }
          },
          required: []
        }
      }
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
      case "list_changed_files":
        return this.git.listChangedFiles(input.ref1 as string, input.ref2 as string);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
  
  buildSystemPrompt(scenario: Scenario): string {
    return `You are a code review agent. Analyze code changes against security and quality invariants.

Use filesystem and git tools to read code, examine diffs, and verify compliance with rules.

Focus on the "review" criteria from the scenario. No runtime execution needed.

After analysis, evaluate each expectation and return a JSON result.`;
  }
}
