import { LogicAgent } from "./logic-agent.js";
/**
 * Reads a failing scenario result and proposes a code fix.
 * Inherits the full read/grep/git toolset from LogicAgent and adds the
 * built-in write_file tool when `enableWrites` is set.
 */
export class FixAgent extends LogicAgent {
    buildSystemPrompt(_scenario) {
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
    async fixFailure(spec, result) {
        this.toolCalls = [];
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
        return this.runConversation(this.buildSystemPrompt({}), context, {
            maxToolResultBytes: 8000,
        });
    }
}
//# sourceMappingURL=fix-agent.js.map