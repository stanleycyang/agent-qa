# AgentQA Phase 1 MVP — Build Task

You are a Senior TypeScript/Node.js engineer building a new open-source project called AgentQA.

## Project Brief

AgentQA is an agent-driven testing framework. Natural language YAML specs → AI agents execute them → results posted as PR comments.

Build the complete Phase 1 MVP monorepo from scratch.

## Project Structure to Create

```
agentqa/
├── packages/
│   ├── core/                   # Orchestration engine
│   │   ├── src/
│   │   │   ├── orchestrator.ts  # Main entry — reads spec, builds plan, dispatches agents
│   │   │   ├── spec-parser.ts   # Parses .agentqa/ YAML specs (Zod validation)
│   │   │   ├── diff-analyzer.ts # Maps git diff file paths → matching specs
│   │   │   ├── plan-builder.ts  # Builds execution plan from matched specs
│   │   │   └── types.ts         # All shared TypeScript types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── agents/                  # Agent implementations
│   │   ├── src/
│   │   │   ├── base-agent.ts    # Abstract base: Anthropic tool-use loop
│   │   │   ├── ui-agent.ts      # Browser E2E via Playwright tools
│   │   │   ├── api-agent.ts     # HTTP/API testing
│   │   │   ├── logic-agent.ts   # Static code review (no runtime needed)
│   │   │   └── reporter-agent.ts # Aggregates results, generates markdown
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── tools/                   # Tools agents invoke
│   │   ├── src/
│   │   │   ├── browser.ts       # Playwright: navigate, click, type, screenshot, getContent
│   │   │   ├── http.ts          # HTTP client: GET/POST/PUT/DELETE + response validation
│   │   │   ├── filesystem.ts    # Read files, grep, list directory
│   │   │   ├── git.ts           # Git diff, checkout, branch comparison
│   │   │   └── assertions.ts    # Semantic assertion engine (LLM-powered pass/fail)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cli/                     # CLI
│       ├── src/
│       │   ├── index.ts         # Entry point (Commander.js)
│       │   ├── commands/
│       │   │   ├── run.ts       # agentqa run [spec]
│       │   │   └── init.ts      # agentqa init — scaffold .agentqa/ dir
│       │   └── config.ts        # Load .agentqa/config.yaml
│       ├── package.json
│       └── tsconfig.json
│
├── .agentqa/                    # Example specs (self-test)
│   ├── config.yaml
│   └── specs/
│       └── example.yaml
│
├── docs/
│   ├── getting-started.md
│   └── writing-specs.md
│
├── turbo.json
├── package.json                 # Root (npm workspaces)
├── tsconfig.base.json
└── README.md
```

## Key Types (types.ts)

```typescript
export type EnvironmentType = "web" | "api" | "logic";

export interface SpecTrigger {
  paths?: string[];
  labels?: string[];
}

export interface SpecEnvironment {
  type: EnvironmentType;
  base_url?: string;
  setup?: Array<{ seed: string }>;
}

export interface ScenarioStep {
  steps?: string[];
  review?: string[];  // for logic type
  expect: string[];
  on_failure?: "screenshot" | "trace" | "both";
}

export interface Scenario extends ScenarioStep {
  name: string;
}

export interface AgentQASpec {
  name: string;
  description?: string;
  trigger: SpecTrigger;
  environment: SpecEnvironment;
  scenarios: Scenario[];
}

export interface ExpectationResult {
  text: string;
  status: "pass" | "fail" | "skip";
  confidence?: number;
  evidence?: string;
  reasoning?: string;
}

export interface ScenarioResult {
  scenario: string;
  status: "pass" | "fail" | "error";
  expectations: ExpectationResult[];
  duration_ms: number;
  screenshots?: string[];
  error?: string;
  trace?: ToolCall[];
}

export interface SpecResult {
  spec: string;
  scenarios: ScenarioResult[];
  status: "pass" | "fail" | "error";
  duration_ms: number;
}

export interface ExecutionPlan {
  specs: Array<{
    spec: AgentQASpec;
    specPath: string;
    scenarios: Scenario[];
  }>;
  environment: {
    base_url?: string;
    api_url?: string;
  };
}

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  timestamp: number;
}

export interface AgentQAConfig {
  version: number;
  model?: {
    provider?: string;
    model?: string;
    vision_model?: string;
  };
  execution?: {
    concurrency?: number;
    timeout_per_scenario?: number;
    retries?: number;
    screenshot_on_failure?: boolean;
  };
  environment?: {
    preview_url?: string;
    api_url?: string;
    env_file?: string;
  };
  reporting?: {
    github_comment?: boolean;
    github_status?: boolean;
    verbose?: boolean;
    artifact_screenshots?: boolean;
  };
}
```

## Base Agent Pattern (base-agent.ts)

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { ToolCall, ScenarioResult, Scenario } from "../../core/src/types";

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
    return `Execute this test scenario:\n\nName: ${scenario.name}\nEnvironment: ${JSON.stringify(environment, null, 2)}\n\nSteps:\n${steps}\n\nAfter completing steps, verify these expectations:\n${expectations}\n\nReturn a JSON result with this structure:\n{\n  "status": "pass" | "fail" | "error",\n  "expectations": [\n    { "text": "...", "status": "pass" | "fail", "confidence": 0.0-1.0, "evidence": "..." }\n  ],\n  "summary": "..."\n}`;
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
```

## What to Build

Implement every file listed in the structure above. Make it production-quality TypeScript:

1. **packages/core/src/types.ts** — all types as shown above
2. **packages/core/src/spec-parser.ts** — Zod schema for specs, parse YAML files from .agentqa/specs/
3. **packages/core/src/diff-analyzer.ts** — glob pattern matching of file paths to spec triggers (use minimatch)
4. **packages/core/src/plan-builder.ts** — build ExecutionPlan from matched specs
5. **packages/core/src/orchestrator.ts** — wires everything together
6. **packages/agents/src/base-agent.ts** — as shown above
7. **packages/agents/src/ui-agent.ts** — extends BaseAgent, uses browser tools (Playwright)
8. **packages/agents/src/api-agent.ts** — extends BaseAgent, uses http tools
9. **packages/agents/src/logic-agent.ts** — extends BaseAgent, uses filesystem/git tools for code review
10. **packages/agents/src/reporter-agent.ts** — aggregates SpecResults into markdown report
11. **packages/tools/src/browser.ts** — Playwright wrapper (navigate, click, type, screenshot, getContent, getTitle, waitForSelector)
12. **packages/tools/src/http.ts** — axios wrapper (get, post, put, delete, assertStatus, validateJson)
13. **packages/tools/src/filesystem.ts** — fs wrapper (readFile, listDir, grepFile)
14. **packages/tools/src/git.ts** — simple-git wrapper (getDiff, listChangedFiles, checkout)
15. **packages/tools/src/assertions.ts** — LLM-powered semantic assertion engine
16. **packages/cli/src/index.ts** — Commander.js CLI entry
17. **packages/cli/src/commands/run.ts** — `agentqa run [spec]` command with colored output
18. **packages/cli/src/commands/init.ts** — `agentqa init` scaffolds .agentqa/
19. **packages/cli/src/config.ts** — reads .agentqa/config.yaml
20. **All package.json files** — correct dependencies, exports, bin entries
21. **turbo.json** — turborepo config
22. **Root package.json** — workspace config with npm workspaces
23. **tsconfig.base.json** — shared TypeScript config
24. **.agentqa/config.yaml** — example config
25. **.agentqa/specs/example.yaml** — example checkout flow spec
26. **README.md** — getting started, installation, usage
27. **docs/getting-started.md**
28. **docs/writing-specs.md**

## Stack
- TypeScript + Node.js
- Anthropic SDK (raw tool use, no LangChain)
- Playwright (browser automation)
- Commander.js (CLI)
- Zod (validation)
- js-yaml (YAML parsing)
- minimatch (glob matching)
- simple-git (git operations)
- axios (HTTP)
- chalk + ora (terminal UX)
- turbo (monorepo)
- npm workspaces

## CLI UX

```
$ agentqa run
🔍 Loading specs from .agentqa/specs/...
📋 Found 2 specs: checkout-flow, api-users
🚀 Running checkout-flow (3 scenarios)...
  ✅ Happy path credit card checkout (14.2s)
  ✅ Declined card shows error (8.1s)
  ❌ Apple Pay visibility check (5.3s)
     → Expected: "Apple Pay button is visible"
     → Got: No Apple Pay option found on payment page

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 4 passed  ❌ 1 failed  (total: 33.6s)
```

Build all the files. Make them real implementations, not stubs. After writing all files, run `npm install` from the root and ensure it compiles with `npm run build`.

When completely finished, run:
openclaw system event --text "Done: AgentQA Phase 1 MVP scaffolded at /Users/stanleyyang/workspace/agentqa" --mode now
