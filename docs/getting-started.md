# Getting Started with AgentQA

## Prerequisites

- Node.js 18+
- An Anthropic API key (`ANTHROPIC_API_KEY`)
- A running app to test (local or preview URL)

## Installation

```bash
npm install -g agentqa
```

## Initialize Your Project

```bash
cd your-app
agentqa init
```

This creates:
```
.agentqa/
├── config.yaml      ← global settings
└── specs/
    └── example.yaml ← starter spec to edit
```

## Set Your API Key

```bash
export ANTHROPIC_API_KEY=your_key_here
```

Or add it to `.env.test` (referenced in `config.yaml`).

## Write Your First Spec

Edit `.agentqa/specs/example.yaml`:

```yaml
name: Login Flow
description: Validates user login

trigger:
  paths:
    - "src/auth/**"

environment:
  type: web
  base_url: "http://localhost:3000"

scenarios:
  - name: "Successful login"
    steps:
      - "Navigate to /login"
      - "Enter username test@example.com"
      - "Enter password password123"
      - "Click the login button"
    expect:
      - "User is redirected to the dashboard"
      - "Username is shown in the header"
    on_failure: screenshot
```

## Run It

```bash
# Start your app first
npm run dev

# In another terminal:
agentqa run
```

You'll see output like:

```
✔ Found 1 spec: Login Flow
🚀 Running Login Flow (1 scenario)...
  ✅ Successful login (12.4s)

────────────────────────────────────────
✅ 1 passed  (total: 12.4s)
```

## Next Steps

- [Writing Specs](./writing-specs.md) — full spec reference
- Add more scenarios to cover edge cases
- Set up [GitHub Actions integration](./ci-integration.md) for PR automation
