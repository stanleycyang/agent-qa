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
    on_failure: screenshot
`;

export async function initCommand(rootDir: string = process.cwd()): Promise<void> {
  const agentqaDir = path.join(rootDir, ".agentqa");
  const specsDir = path.join(agentqaDir, "specs");
  const configPath = path.join(agentqaDir, "config.yaml");
  const exampleSpecPath = path.join(specsDir, "example.yaml");
  
  console.log(chalk.blue("🚀 Initializing AgentQA...\n"));
  
  // Create directories
  await fs.mkdir(agentqaDir, { recursive: true });
  await fs.mkdir(specsDir, { recursive: true });
  
  // Write config
  await fs.writeFile(configPath, DEFAULT_CONFIG);
  console.log(chalk.green("✓") + " Created .agentqa/config.yaml");
  
  // Write example spec
  await fs.writeFile(exampleSpecPath, EXAMPLE_SPEC);
  console.log(chalk.green("✓") + " Created .agentqa/specs/example.yaml");
  
  console.log(chalk.green("\n✅ AgentQA initialized!\n"));
  console.log("Next steps:");
  console.log("  1. Edit .agentqa/specs/example.yaml to match your app");
  console.log("  2. Run: " + chalk.cyan("agentqa run"));
  console.log("  3. See docs: " + chalk.cyan("https://github.com/yourusername/agentqa\n"));
}
