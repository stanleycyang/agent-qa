# Writing Specs

Specs are YAML files in `.agentqa/specs/`. They describe test intent in plain English — agents figure out how to execute them.

## Spec Structure

```yaml
name: string           # Display name
description: string    # Optional description

trigger:               # When to run this spec
  paths:               # File path globs (minimatch)
    - "src/**/*.ts"
  labels:              # PR labels
    - "checkout"

environment:
  type: web | api | logic
  base_url: string     # Supports {{ENV_VAR}} interpolation
  setup:
    - seed: "fixtures/data.sql"

scenarios:
  - name: string
    steps:             # Plain English actions
      - "Do this"
      - "Then do that"
    review:            # For logic type: things to check (no runtime)
      - "No hardcoded tokens in the diff"
    expect:            # Assertions (semantically evaluated by LLM)
      - "Something should be true"
    on_failure: screenshot | trace | both
```

## Environment Types

### `web` — Browser UI Testing

```yaml
environment:
  type: web
  base_url: "http://localhost:3000"
```

The UIAgent uses Playwright to navigate, click, type, and take screenshots. Assertions are evaluated semantically against page content and screenshots.

**Good for:** checkout flows, form submissions, navigation, visual regressions

### `api` — HTTP API Testing

```yaml
environment:
  type: api
  base_url: "http://localhost:3000"
```

The APIAgent makes HTTP requests and validates responses. No browser needed.

**Good for:** CRUD endpoints, auth flows, webhook handling, status codes

Example:
```yaml
scenarios:
  - name: "Create user"
    steps:
      - "POST /api/users with name John and email john@example.com"
      - "Store the returned user ID"
      - "GET /api/users/{id}"
    expect:
      - "POST returns 201 with the user object"
      - "GET returns the same user"
```

### `logic` — Code Review (no runtime)

```yaml
environment:
  type: logic
```

The LogicAgent reads source files and git diffs — no running app needed. Use for security invariants, code quality rules, and architecture constraints.

**Good for:** security reviews, dependency checks, pattern enforcement

Example:
```yaml
scenarios:
  - name: "No auth bypasses"
    review:
      - "All admin routes use requireAuth middleware"
      - "No hardcoded API keys in the diff"
      - "JWT expiry not extended beyond 24 hours"
    expect:
      - "No auth bypasses introduced"
      - "No secrets in the code"
```

## Triggers

Specs run when changed files match the trigger patterns:

```yaml
trigger:
  paths:
    - "src/checkout/**"      # Glob pattern
    - "src/payments/**"
    - "src/models/order.*"
  labels:
    - "checkout"             # PR label match
```

If no `paths` are set, the spec always runs.

## Expectations

Expectations are natural language — the LLM evaluates them semantically, not with string matching:

```yaml
expect:
  - "Order confirmation page is displayed"    # Visual check
  - "An order number is visible"              # Content check  
  - "POST returns 201 with the user object"   # API check
  - "No hardcoded passwords in the diff"      # Code check
```

## Environment Variables

Use `{{VAR_NAME}}` in YAML values:

```yaml
environment:
  base_url: "{{VERCEL_PREVIEW_URL}}"
```

These are resolved from environment variables at runtime.

## on_failure Options

```yaml
on_failure: screenshot   # Capture screenshot on failure (web only)
on_failure: trace        # Save full agent trace
on_failure: both         # Screenshot + trace
```
