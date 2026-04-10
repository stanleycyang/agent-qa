import Anthropic from "@anthropic-ai/sdk";
import { emptyUsage } from "@agentqa/core";
import * as fs from "fs/promises";
import * as path from "path";
export class BaseAgent {
    client;
    model;
    toolCalls = [];
    allowWrites = false;
    writeRoot = process.cwd();
    tokenUsage = emptyUsage();
    constructor(model = "claude-opus-4-5") {
        this.client = new Anthropic();
        this.model = model;
    }
    /** Get accumulated token usage and reset the counter. */
    getAndResetUsage() {
        const usage = { ...this.tokenUsage };
        this.tokenUsage = emptyUsage();
        return usage;
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
        // Use path.relative so a sibling like "/foo/barx" can't masquerade as a
        // child of "/foo/bar" via String.startsWith.
        const root = path.resolve(this.writeRoot);
        const fullPath = path.resolve(root, relPath);
        const rel = path.relative(root, fullPath);
        if (rel.startsWith("..") || path.isAbsolute(rel)) {
            return { error: "Path escapes write root", success: false };
        }
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, input.content);
        return { success: true, path: fullPath };
    }
    /**
     * Drive a conversation loop with the model: send the prompt, handle any
     * tool calls (including the built-in write_file when allowed), and return
     * the final assistant text. Used by both `runScenario` and free-form
     * tasks like spec generation and fix proposal.
     */
    async runConversation(systemPrompt, initialUserMessage, options = {}) {
        const maxBytes = options.maxToolResultBytes ?? Infinity;
        const messages = [
            { role: "user", content: initialUserMessage },
        ];
        const tools = [...this.getTools(), ...this.getWriteTools()];
        while (true) {
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 4096,
                system: systemPrompt,
                tools,
                messages,
            });
            // Accumulate token usage
            if (response.usage) {
                this.tokenUsage.input_tokens += response.usage.input_tokens ?? 0;
                this.tokenUsage.output_tokens += response.usage.output_tokens ?? 0;
                this.tokenUsage.cache_read_tokens += response.usage.cache_read_input_tokens ?? 0;
                this.tokenUsage.cache_creation_tokens += response.usage.cache_creation_input_tokens ?? 0;
            }
            messages.push({ role: "assistant", content: response.content });
            if (response.stop_reason === "end_turn") {
                return response.content
                    .filter((b) => b.type === "text")
                    .map(b => b.text)
                    .join("\n");
            }
            if (response.stop_reason !== "tool_use") {
                // Unexpected stop reason — return whatever text we have
                return response.content
                    .filter((b) => b.type === "text")
                    .map(b => b.text)
                    .join("\n");
            }
            const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
            const toolResults = [];
            for (const toolUse of toolUseBlocks) {
                const input = toolUse.input;
                const output = toolUse.name === "write_file"
                    ? await this.handleWriteTool(toolUse.name, input)
                    : await this.handleToolCall(toolUse.name, input);
                this.toolCalls.push({
                    tool: toolUse.name,
                    input,
                    output,
                    timestamp: Date.now(),
                });
                const serialized = JSON.stringify(output);
                toolResults.push({
                    type: "tool_result",
                    tool_use_id: toolUse.id,
                    content: serialized.length > maxBytes ? serialized.substring(0, maxBytes) : serialized,
                });
            }
            messages.push({ role: "user", content: toolResults });
        }
    }
    async runScenario(scenario, environment) {
        this.toolCalls = [];
        this.tokenUsage = emptyUsage();
        const start = Date.now();
        const userPrompt = this.buildUserPrompt(scenario, environment);
        const finalText = await this.runConversation(this.buildSystemPrompt(scenario), userPrompt);
        const result = this.parseResult(scenario, finalText, start);
        result.tokenUsage = this.getAndResetUsage();
        return result;
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