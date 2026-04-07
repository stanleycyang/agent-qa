import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs/promises";
import * as path from "path";
export class BaseAgent {
    client;
    model;
    toolCalls = [];
    allowWrites = false;
    writeRoot = process.cwd();
    constructor(model = "claude-opus-4-5") {
        this.client = new Anthropic();
        this.model = model;
    }
    /** Enable file writes from within the agent loop. Used by fix-agent and auto-heal. */
    enableWrites(rootDir = process.cwd()) {
        this.allowWrites = true;
        this.writeRoot = rootDir;
    }
    /** Built-in write_file tool exposed when allowWrites is true. */
    getWriteTools() {
        if (!this.allowWrites)
            return [];
        return [
            {
                name: "write_file",
                description: "Write content to a file at the given path. Creates parent directories if needed. Use this to apply fixes or update spec files.",
                input_schema: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: "File path relative to the project root" },
                        content: { type: "string", description: "Full file content to write" },
                    },
                    required: ["path", "content"],
                },
            },
        ];
    }
    async handleWriteTool(name, input) {
        if (name !== "write_file" || !this.allowWrites)
            return null;
        const relPath = input.path;
        // Resolve and verify the path stays within writeRoot to prevent escapes
        const fullPath = path.resolve(this.writeRoot, relPath);
        if (!fullPath.startsWith(path.resolve(this.writeRoot))) {
            return { error: "Path escapes write root", success: false };
        }
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, input.content);
        return { success: true, path: fullPath };
    }
    async runScenario(scenario, environment) {
        this.toolCalls = [];
        const start = Date.now();
        const messages = [];
        const userPrompt = this.buildUserPrompt(scenario, environment);
        messages.push({ role: "user", content: userPrompt });
        while (true) {
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 4096,
                system: this.buildSystemPrompt(scenario),
                tools: [...this.getTools(), ...this.getWriteTools()],
                messages,
            });
            messages.push({ role: "assistant", content: response.content });
            if (response.stop_reason === "end_turn") {
                const finalText = response.content
                    .filter((b) => b.type === "text")
                    .map(b => b.text)
                    .join("\n");
                return this.parseResult(scenario, finalText, start);
            }
            if (response.stop_reason === "tool_use") {
                const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
                const toolResults = [];
                for (const toolUse of toolUseBlocks) {
                    let output;
                    if (toolUse.name === "write_file") {
                        output = await this.handleWriteTool(toolUse.name, toolUse.input);
                    }
                    else {
                        output = await this.handleToolCall(toolUse.name, toolUse.input);
                    }
                    this.toolCalls.push({
                        tool: toolUse.name,
                        input: toolUse.input,
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
    buildUserPrompt(scenario, environment) {
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
    parseResult(scenario, finalText, startTime) {
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
        }
        catch (e) {
            console.warn(`Failed to parse agent JSON result: ${e.message}\nRaw output (truncated): ${finalText.substring(0, 500)}`);
        }
        return {
            scenario: scenario.name,
            status: "error",
            expectations: scenario.expect.map(e => ({ text: e, status: "skip" })),
            duration_ms: Date.now() - startTime,
            error: "Could not parse agent result",
        };
    }
}
//# sourceMappingURL=base-agent.js.map