# AgentQA

> **Describe what should work. Agents verify that it does.**

AgentQA is an open-source, agent-driven testing framework. Write test specs in plain English YAML — AI agents execute them against your app and post results as PR comments.

No Cypress selectors. No brittle Playwright scripts. Just intent.

---

## Why AgentQA?

| Pain today | AgentQA solution |
|---|---|
| Writing E2E tests is slow and brittle | Write plain English, agents handle the how |
| Selectors break on every UI change | Agents use visual + semantic understanding |
| CI suites grow stale | Natural language specs are easy to update |
| New devs can't write tests | Anyone who can describe behavior can write a spec |

---

## Quick Start

```bash
# Install
npm install -g agentqa

# Initialize in your repo
cd my-app
agentqa init

# Edit your first spec
vim .agentqa/specs/my-feature.yaml

# Run locally
agentqa run

# Run a specific spec
agentqa run checkout-flow
```

---

## Writing Specs

Specs live in `.agentqa/specs/` as YAML files:

```yaml
name: Checkout Flow
description: Validates the purchase flow

trigger:
  paths:
    - "src/checkout/**"
    - "src/payments/**"

environment:
  type: web
  base_url: "{{VERCEL_PREVIEW_URL}}"

scenarios:
  - name: "Happy path checkout"
    steps:
      - "Navigate to the product listing page"
      - "Add the first product to cart"
      - "Proceed to checkout"
      - "Enter test card 4242424242424242"
      - "Submit the order"
    expect:
      - "Order confirmation page is displayed"
      - "An order number is visible"
    on_failure: screenshot
```

### Environment Types

| Type | Use for | Agent |
|------|---------|-------|
| `web` | Browser-based UI testing | UIAgent (Playwright) |
| `api` | HTTP API testing | APIAgent |
| `logic` | Code review, no runtime needed | LogicAgent |

---

## Configuration

```yaml
# .agentqa/config.yaml
version: 1

model:
  provider: anthropic
  model: claude-sonnet-4-20250514

execution:
  concurrency: 3
  timeout_per_scenario: 120
  retries: 1
  screenshot_on_failure: true

environment:
  preview_url: "{{VERCEL_PREVIEW_URL}}"

reporting:
  github_comment: true
  github_status: true
```

Set `ANTHROPIC_API_KEY` in your environment.

---

## CLI Commands

```bash
agentqa init          # Scaffold .agentqa/ in your project
agentqa run           # Run all specs
agentqa run <name>    # Run a specific spec by name
```

---

## Architecture

```
PR Event → Orchestrator → Diff Analyzer → Plan Builder
                                             ↓
                              UIAgent / APIAgent / LogicAgent
                                             ↓
                                       ReporterAgent
                                             ↓
                                    PR Comment + Status Check
```

- **Orchestrator**: Reads PR diff, maps changed files → relevant specs
- **UIAgent**: Playwright browser automation + vision-powered assertions
- **APIAgent**: HTTP client + semantic response validation
- **LogicAgent**: Code review against security/quality invariants
- **ReporterAgent**: Markdown results, PR comments, GitHub status checks

---

## Project Structure

```
agentqa/
├── packages/
│   ├── core/       # Types, spec parser, diff analyzer, orchestrator
│   ├── agents/     # BaseAgent + UIAgent, APIAgent, LogicAgent, ReporterAgent
│   ├── tools/      # Browser, HTTP, filesystem, git, assertions
│   └── cli/        # agentqa CLI (run, init)
├── .agentqa/       # Example specs
└── docs/           # Documentation
```

---

## Roadmap

- [x] Phase 1: Core monorepo, agents, CLI
- [ ] Phase 2: GitHub Action + PR comment integration
- [ ] Phase 3: Vision-powered assertions, regression agent
- [ ] Phase 4: Auto-spec generation, VS Code extension
- [ ] Phase 5: Managed cloud offering

---

## License

MIT
