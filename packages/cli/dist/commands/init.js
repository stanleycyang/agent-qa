import * as fs from "fs/promises";
import * as path from "path";
import chalk from "chalk";
const DEFAULT_CONFIG = `version: 1

model:
  provider: anthropic
  model: claude-sonnet-4-20250514
  vision_model: claude-sonnet-4-20250514

execution:
  concurrency: 3
  timeout_per_scenario: 120
  retries: 1
  screenshot_on_failure: true

environment:
  preview_url: "{{VERCEL_PREVIEW_URL}}"
  api_url: "{{API_URL}}"
  env_file: ".env.test"

reporting:
  github_comment: true
  github_status: true
  verbose: false
  artifact_screenshots: true
`;
const EXAMPLE_SPEC = `name: Example Checkout Flow
description: Validates a simple e-commerce checkout

trigger:
  paths:
    - "src/checkout/**"
    - "src/cart/**"

environment:
  type: web
  base_url: "http://localhost:3000"

scenarios:
  - name: "Happy path checkout"
    steps:
      - "Navigate to the homepage"
      - "Click on the first product"
      - "Add to cart"
      - "Proceed to checkout"
      - "Fill in test payment details"
      - "Submit the order"
    expect:
      - "Order confirmation page is displayed"
      - "An order number is visible"
      - "No visual regressions on the confirmation page (use check_visual_regression with baseline_name 'confirmation')"
      - "No broken layout or overflow issues (use detect_visual_issues)"
    on_failure: screenshot
`;
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
export async function initCommand(rootDir = process.cwd(), force) {
    const agentqaDir = path.join(rootDir, ".agentqa");
    const specsDir = path.join(agentqaDir, "specs");
    const configPath = path.join(agentqaDir, "config.yaml");
    const exampleSpecPath = path.join(specsDir, "example.yaml");
    console.log(chalk.blue("🚀 Initializing AgentQA...\n"));
    // Create directories
    await fs.mkdir(agentqaDir, { recursive: true });
    await fs.mkdir(specsDir, { recursive: true });
    // Write config (skip if exists unless --force)
    if (force || !await fileExists(configPath)) {
        await fs.writeFile(configPath, DEFAULT_CONFIG);
        console.log(chalk.green("✓") + " Created .agentqa/config.yaml");
    }
    else {
        console.log(chalk.yellow("⚠") + " .agentqa/config.yaml already exists, skipping (use --force to overwrite)");
    }
    // Write example spec (skip if exists unless --force)
    if (force || !await fileExists(exampleSpecPath)) {
        await fs.writeFile(exampleSpecPath, EXAMPLE_SPEC);
        console.log(chalk.green("✓") + " Created .agentqa/specs/example.yaml");
    }
    else {
        console.log(chalk.yellow("⚠") + " .agentqa/specs/example.yaml already exists, skipping (use --force to overwrite)");
    }
    console.log(chalk.green("\n✅ AgentQA initialized!\n"));
    console.log("Next steps:");
    console.log("  1. Edit .agentqa/specs/example.yaml to match your app");
    console.log("  2. Set your API key: " + chalk.cyan("export ANTHROPIC_API_KEY=sk-ant-..."));
    console.log("  3. Run: " + chalk.cyan("agentqa run"));
    console.log("  4. Validate: " + chalk.cyan("agentqa validate"));
}
//# sourceMappingURL=init.js.map