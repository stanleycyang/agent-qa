import { Scenario } from "@agentqa/core";
import { LogicAgent } from "./logic-agent.js";

/**
 * Generates AgentQA YAML specs from various inputs (git diff, Figma, Sentry, Linear/Jira).
 * Inherits the read/grep/git toolset from LogicAgent. Unlike test-execution
 * agents, the caller invokes `generateFromContext()` and gets back the raw
 * agent text containing fenced YAML blocks.
 */
export class SpecGeneratorAgent extends LogicAgent {
  buildSystemPrompt(_scenario: Scenario): string {
    return SPEC_GENERATOR_PROMPT;
  }

  async generateFromContext(context: string): Promise<string> {
    this.toolCalls = [];
    return this.runConversation(SPEC_GENERATOR_PROMPT, context, { maxToolResultBytes: 8000 });
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

Then briefly explain what each spec covers.`;
