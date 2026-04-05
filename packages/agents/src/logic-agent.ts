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
        description: "Read the full contents of a file. Use for reviewing implementation code.",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to read (relative or absolute)" }
          },
          required: ["path"]
        }
      },
      {
        name: "list_dir",
        description: "List all files and directories in a path. Use to discover project structure.",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path to list" }
          },
          required: ["path"]
        }
      },
      {
        name: "grep_file",
        description: "Search for a regex pattern in a specific file. Returns matching lines.",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to search" },
            pattern: { type: "string", description: "Regex pattern to search for" }
          },
          required: ["path", "pattern"]
        }
      },
      {
        name: "grep_directory",
        description: "Search for a regex pattern across all files in a directory (recursive). Returns matching file paths and lines.",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory to search in" },
            pattern: { type: "string", description: "Regex pattern to search for" },
            file_pattern: { type: "string", description: "Glob pattern to filter files (e.g. '*.ts', '*.py')" }
          },
          required: ["path", "pattern"]
        }
      },
      {
        name: "git_diff",
        description: "Get the git diff showing code changes. Without refs, shows unstaged changes. With refs, shows diff between them.",
        input_schema: {
          type: "object",
          properties: {
            ref1: { type: "string", description: "First git ref (branch, commit, tag)" },
            ref2: { type: "string", description: "Second git ref" }
          },
          required: []
        }
      },
      {
        name: "list_changed_files",
        description: "List files that changed between two git refs (or current unstaged changes).",
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
        name: "file_exists",
        description: "Check if a file or directory exists at the given path.",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Path to check" }
          },
          required: ["path"]
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
      case "grep_directory":
        return this.grepDirectory(
          input.path as string,
          input.pattern as string,
          input.file_pattern as string | undefined
        );
      case "git_diff":
        return this.git.getDiff(input.ref1 as string, input.ref2 as string);
      case "list_changed_files":
        return this.git.listChangedFiles(input.ref1 as string, input.ref2 as string);
      case "file_exists":
        return this.fs.exists(input.path as string);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async grepDirectory(
    dirPath: string,
    pattern: string,
    filePattern?: string,
  ): Promise<{ matches: Array<{ file: string; line: string }> }> {
    const results: Array<{ file: string; line: string }> = [];
    const files = await this.fs.listDir(dirPath);
    const regex = filePattern ? new RegExp(filePattern.replace(/\*/g, ".*")) : null;

    for (const file of files.files) {
      if (regex && !regex.test(file)) continue;
      const fullPath = `${dirPath}/${file}`;
      try {
        const { matches } = await this.fs.grepFile(fullPath, pattern);
        for (const match of matches) {
          results.push({ file: fullPath, line: match });
        }
      } catch {
        // Skip directories or unreadable files
      }
    }
    return { matches: results };
  }

  buildSystemPrompt(scenario: Scenario): string {
    return `You are a code review agent that analyzes source code for correctness, security, and quality.

## Your approach
1. **Understand scope** — start with list_changed_files or git_diff to see what changed
2. **Read the code** — read each changed file to understand the implementation
3. **Analyze against criteria** — check the review criteria from the scenario
4. **Search for patterns** — use grep_file and grep_directory to find related code, usages, or anti-patterns
5. **Evaluate expectations** — determine if the code meets each expectation

## What to look for
- **Security**: SQL injection, XSS, command injection, hardcoded secrets, unsafe deserialization, missing auth checks
- **Correctness**: Off-by-one errors, null pointer risks, race conditions, missing error handling, incorrect logic
- **Quality**: Dead code, duplicated logic, overly complex functions, missing input validation
- **Dependencies**: Vulnerable packages, unnecessary dependencies, version conflicts

## Review strategy
- Read diffs first to understand what changed
- Then read the full files for context around the changes
- Use grep_directory to find similar patterns across the codebase
- Check that new functions have proper error handling
- Verify that security-sensitive operations have proper validation

## Evidence and confidence
- **confidence 0.9-1.0**: Clear evidence found (specific line of vulnerable code, concrete pattern match)
- **confidence 0.7-0.8**: Likely issue found (pattern looks suspicious but has mitigating context)
- **confidence 0.5-0.6**: Possible issue (unclear without runtime testing)
- Always include evidence: file path, line content, pattern description

## Output format
After completing your review, return your result as a JSON code block:
\`\`\`json
{
  "status": "pass" | "fail" | "error",
  "expectations": [
    { "text": "the expectation text", "status": "pass" | "fail", "confidence": 0.9, "evidence": "file.ts: found hardcoded API key on line 42", "reasoning": "explanation of the finding" }
  ],
  "summary": "brief overall summary of the review"
}
\`\`\``;
  }
}
