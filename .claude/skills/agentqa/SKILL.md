---
name: agentqa
description: Run AgentQA against the current edit to catch regressions and propose fixes before shipping.
---

# AgentQA Skill

AgentQA is an agent-driven testing framework. It runs natural language specs against the app and catches regressions, then proposes fixes — so vibe coders can ship fast without worrying about what they broke.

## When to use

- **After editing source code** (`src/**`, `app/**`, `lib/**`, `pages/**`): Run `agentqa impact --dry-run --since HEAD` to see which specs are affected by the changes. Offer to run the impacted specs before committing.
- **Before committing**: Run `agentqa impact --top 5` to execute the 5 most relevant specs. If any fail, run with `--auto-fix` to get a fix proposal.
- **After a test failure**: Run `agentqa explain last` to get a forensic root-cause analysis.
- **When adding new features**: Run `agentqa generate <file>` to auto-generate specs for new endpoints, components, or flows.
- **When asked to test**: Run `agentqa run [spec-name]` to run a specific spec, or `agentqa run` to run all specs.

## Commands

### Impact analysis (fastest feedback loop)
```bash
# See which specs are at risk from current changes
agentqa impact --dry-run --since HEAD

# Run only the impacted specs (30s instead of full suite)
agentqa impact --top 5

# Impact with auto-fix proposals on failure
agentqa impact --top 5 --auto-fix
```

### Run specs
```bash
# Run all specs
agentqa run

# Run a specific spec by name
agentqa run "checkout"

# Run with auto-fix on failure
agentqa run --auto-fix

# Run and get JSON output
agentqa run --json
```

### Explain failures
```bash
# Explain the most recent failure
agentqa explain last

# Explain a specific failure by ID
agentqa explain "Checkout Flow::credit card checkout::1712345678"
```

### Generate specs
```bash
# Auto-generate specs from recent git changes
agentqa generate

# Generate spec for a specific file
agentqa generate src/checkout/payment.ts

# Preview without writing
agentqa generate --dry-run
```

### Other commands
```bash
agentqa validate     # Check specs and config
agentqa gaps         # Find code not covered by any spec
agentqa flaky        # List flaky scenarios
agentqa report --input results.json  # Generate markdown report from JSON
agentqa mcp          # Start as MCP server for other agents
```

## Spec format

Specs live in `.agentqa/specs/*.yaml`:

```yaml
name: Feature Name
description: What this tests
trigger:
  paths:
    - "src/feature/**"
environment:
  type: web  # web | api | logic | a11y | security
  base_url: "{{PREVIEW_URL}}"
scenarios:
  - name: "Happy path"
    steps:
      - "Navigate to the feature page"
      - "Fill in the form"
      - "Click submit"
    expect:
      - "Success message is displayed"
      - "Data is saved correctly"
```

## Configuration

Config lives in `.agentqa/config.yaml`:

```yaml
version: 1
model:
  model: claude-sonnet-4-20250514
execution:
  concurrency: 2
  timeout_per_scenario: 120
  min_confidence: 0.7
auto_fix:
  enabled: false
  mode: propose  # propose | apply
  min_confidence: 0.8
  max_files: 3
  max_lines: 50
```

## Flow

1. Developer edits code
2. Claude detects the edit and runs `agentqa impact --dry-run`
3. If specs are at risk, Claude offers to run them
4. On failure, Claude runs with `--auto-fix` to get a fix proposal
5. Developer reviews and applies the fix
6. Ship with confidence
