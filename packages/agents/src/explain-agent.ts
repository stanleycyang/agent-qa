import Anthropic from "@anthropic-ai/sdk";
import { Scenario } from "@agentqa/core";
import { LogicAgent } from "./logic-agent.js";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Forensic analysis agent for failed scenarios.
 * Extends LogicAgent (read-only) with tools for browsing replay artifacts,
 * screenshots, and network logs.
 */
export class ExplainAgent extends LogicAgent {
  private rootDir: string;

  constructor(model?: string, rootDir: string = process.cwd()) {
    super(model);
    this.rootDir = rootDir;
  }

  getTools(): Anthropic.Tool[] {
    return [
      ...super.getTools(),
      {
        name: "list_screenshots",
        description: "List available screenshots in the .agentqa/screenshots directory.",
        input_schema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "list_replays",
        description: "List available replay session directories in .agentqa/replays/.",
        input_schema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "read_network_log",
        description: "Read a network log file from a replay directory. Returns the JSON network requests/responses captured during the run.",
        input_schema: {
          type: "object",
          properties: {
            replay_dir: { type: "string", description: "Name of the replay directory under .agentqa/replays/" },
          },
          required: ["replay_dir"],
        },
      },
      {
        name: "read_console_log",
        description: "Read the browser console log from a replay directory.",
        input_schema: {
          type: "object",
          properties: {
            replay_dir: { type: "string", description: "Name of the replay directory under .agentqa/replays/" },
          },
          required: ["replay_dir"],
        },
      },
    ];
  }

  async handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case "list_screenshots": {
        const dir = path.join(this.rootDir, ".agentqa", "screenshots");
        try {
          const files = await fs.readdir(dir);
          return { screenshots: files.filter(f => f.endsWith(".png") || f.endsWith(".jpg")) };
        } catch {
          return { screenshots: [], error: "No screenshots directory found" };
        }
      }
      case "list_replays": {
        const dir = path.join(this.rootDir, ".agentqa", "replays");
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
          return { replays: dirs };
        } catch {
          return { replays: [], error: "No replays directory found" };
        }
      }
      case "read_network_log": {
        const replayDir = input.replay_dir as string;
        const logPath = path.join(this.rootDir, ".agentqa", "replays", replayDir, "network.json");
        try {
          const content = await fs.readFile(logPath, "utf-8");
          const parsed = JSON.parse(content);
          // Truncate to keep context manageable
          const truncated = Array.isArray(parsed) ? parsed.slice(-30) : parsed;
          return { network_log: truncated };
        } catch {
          return { error: `No network log found at ${logPath}` };
        }
      }
      case "read_console_log": {
        const replayDir = input.replay_dir as string;
        const logPath = path.join(this.rootDir, ".agentqa", "replays", replayDir, "console.json");
        try {
          const content = await fs.readFile(logPath, "utf-8");
          const parsed = JSON.parse(content);
          const truncated = Array.isArray(parsed) ? parsed.slice(-50) : parsed;
          return { console_log: truncated };
        } catch {
          return { error: `No console log found at ${logPath}` };
        }
      }
      default:
        return super.handleToolCall(name, input);
    }
  }

  buildSystemPrompt(_scenario: Scenario): string {
    return `You are a forensic QA analyst investigating why a test scenario failed.

## Your approach
1. Read the failure details provided (scenario name, expectations, what the agent saw)
2. Search the codebase for the relevant code paths
3. Check recent git changes that might have caused the regression
4. Look at screenshots, network logs, and console logs from the replay artifacts
5. Form a root cause hypothesis with supporting evidence

## Output format
Produce a clear markdown report:

### Root Cause
1-2 sentences explaining what went wrong and why.

### Evidence
- Bullet list of specific evidence (file paths, line numbers, log entries, screenshots)

### Recommended Fix
What the developer should do to fix this. Be specific — name files and functions.

### Prevention
How to prevent this type of failure in the future (e.g., add a spec, add validation).`;
  }

  /**
   * Analyze a failure and produce a plain-English explanation.
   */
  async explain(context: {
    spec: string;
    scenario: string;
    status: string;
    error?: string;
    timestamp: number;
  }): Promise<string> {
    this.toolCalls = [];

    const prompt = `Investigate this test failure:

Spec: ${context.spec}
Scenario: ${context.scenario}
Status: ${context.status}
${context.error ? `Error: ${context.error}` : ""}
Timestamp: ${new Date(context.timestamp).toISOString()}

Use the available tools to investigate the codebase and any replay artifacts.
Produce a forensic report explaining what went wrong and how to fix it.`;

    return this.runConversation(
      this.buildSystemPrompt({} as Scenario),
      prompt,
      { maxToolResultBytes: 8000 },
    );
  }
}
