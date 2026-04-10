import { describe, it, expect, vi } from "vitest";
import { BaseAgent } from "../base-agent.js";
import type { Scenario, ScenarioResult } from "@agentqa/core";
import Anthropic from "@anthropic-ai/sdk";

// Create a minimal concrete subclass for testing protected/abstract methods
class TestAgent extends BaseAgent {
  getTools(): Anthropic.Tool[] {
    return [];
  }

  async handleToolCall(_name: string, _input: Record<string, unknown>): Promise<unknown> {
    return {};
  }

  buildSystemPrompt(_scenario: Scenario): string {
    return "Test system prompt";
  }

  // Expose protected methods for testing
  public testHandleWriteTool(name: string, input: Record<string, unknown>) {
    return this.handleWriteTool(name, input);
  }

  public testParseResult(scenario: Scenario, text: string, startTime: number) {
    return this.parseResult(scenario, text, startTime);
  }

  public testGetWriteTools() {
    return this.getWriteTools();
  }
}

const testScenario: Scenario = {
  name: "Test scenario",
  steps: ["Step 1"],
  expect: ["Expectation 1", "Expectation 2"],
};

describe("BaseAgent", () => {
  describe("handleWriteTool - path safety", () => {
    it("blocks path traversal with ../", async () => {
      const agent = new TestAgent();
      agent.enableWrites("/project");
      const result = await agent.testHandleWriteTool("write_file", {
        path: "../../../etc/passwd",
        content: "hacked",
      });
      expect(result).toEqual({ error: "Path escapes write root", success: false });
    });

    it("blocks absolute paths", async () => {
      const agent = new TestAgent();
      agent.enableWrites("/project");
      const result = await agent.testHandleWriteTool("write_file", {
        path: "/etc/passwd",
        content: "hacked",
      });
      expect(result).toEqual({ error: "Path escapes write root", success: false });
    });

    it("returns null when writes are not enabled", async () => {
      const agent = new TestAgent();
      const result = await agent.testHandleWriteTool("write_file", {
        path: "src/foo.ts",
        content: "code",
      });
      expect(result).toBeNull();
    });

    it("returns null for non-write_file tool names", async () => {
      const agent = new TestAgent();
      agent.enableWrites("/project");
      const result = await agent.testHandleWriteTool("other_tool", {
        path: "src/foo.ts",
        content: "code",
      });
      expect(result).toBeNull();
    });

    it("blocks sneaky path like ../project2/file", async () => {
      const agent = new TestAgent();
      agent.enableWrites("/project");
      const result = await agent.testHandleWriteTool("write_file", {
        path: "../project2/evil.ts",
        content: "bad",
      });
      expect(result).toEqual({ error: "Path escapes write root", success: false });
    });
  });

  describe("parseResult", () => {
    it("extracts JSON from fenced code block", () => {
      const text = 'Here is the result:\n```json\n{"status": "pass", "expectations": [{"text": "works", "status": "pass"}]}\n```';
      const result = new TestAgent().testParseResult(testScenario, text, Date.now() - 100);
      expect(result.status).toBe("pass");
      expect(result.expectations).toHaveLength(1);
      expect(result.scenario).toBe("Test scenario");
    });

    it("extracts JSON from raw text without fences", () => {
      const text = 'The result is {"status": "fail", "expectations": [{"text": "broken", "status": "fail"}]}';
      const result = new TestAgent().testParseResult(testScenario, text, Date.now() - 100);
      expect(result.status).toBe("fail");
    });

    it("returns error result for unparseable text", () => {
      const text = "This is just plain text with no JSON";
      const result = new TestAgent().testParseResult(testScenario, text, Date.now() - 100);
      expect(result.status).toBe("error");
      expect(result.error).toBe("Could not parse agent result");
      // Should create skip expectations for each expected assertion
      expect(result.expectations).toHaveLength(2);
      expect(result.expectations[0].status).toBe("skip");
    });

    it("tracks duration correctly", () => {
      const startTime = Date.now() - 500;
      const text = '```json\n{"status": "pass", "expectations": []}\n```';
      const result = new TestAgent().testParseResult(testScenario, text, startTime);
      expect(result.duration_ms).toBeGreaterThanOrEqual(400);
    });
  });

  describe("getAndResetUsage", () => {
    it("returns accumulated tokens and resets to zero", () => {
      const agent = new TestAgent();
      // Manually set token usage
      (agent as any).tokenUsage = {
        input_tokens: 100,
        output_tokens: 200,
        cache_read_tokens: 50,
        cache_creation_tokens: 25,
      };

      const usage = agent.getAndResetUsage();
      expect(usage.input_tokens).toBe(100);
      expect(usage.output_tokens).toBe(200);

      // After reset, should be zero
      const reset = agent.getAndResetUsage();
      expect(reset.input_tokens).toBe(0);
      expect(reset.output_tokens).toBe(0);
    });
  });

  describe("getWriteTools", () => {
    it("returns empty when writes are disabled", () => {
      const agent = new TestAgent();
      expect(agent.testGetWriteTools()).toEqual([]);
    });

    it("returns write_file tool when writes are enabled", () => {
      const agent = new TestAgent();
      agent.enableWrites("/project");
      const tools = agent.testGetWriteTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("write_file");
    });
  });
});
