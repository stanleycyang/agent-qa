import * as path from "path";
import chalk from "chalk";
import { loadAllSpecs } from "@agentqa/core";
import { loadConfig } from "../config.js";

export async function validateCommand(rootDir: string = process.cwd()): Promise<void> {
  console.log(chalk.bold("Validating AgentQA configuration...\n"));

  let hasErrors = false;

  // Validate config
  const config = await loadConfig(rootDir);
  console.log(chalk.green("✓") + " Config loaded (model: " + chalk.cyan(config.model?.model ?? "default") + ")");

  // Validate specs
  const specsDir = path.join(rootDir, ".agentqa", "specs");
  try {
    const specEntries = await loadAllSpecs(specsDir);

    if (specEntries.length === 0) {
      console.log(chalk.yellow("\n⚠ No spec files found in .agentqa/specs/"));
      console.log("  Create one with: " + chalk.cyan("agentqa init"));
      hasErrors = true;
    } else {
      console.log(chalk.green("✓") + ` Found ${specEntries.length} valid spec(s):\n`);
      for (const { spec } of specEntries) {
        console.log(`  ${chalk.cyan(spec.name)} [${spec.environment.type}]`);
        console.log(chalk.gray(`    ${spec.scenarios.length} scenario(s)`));
        if (spec.trigger.paths?.length) {
          console.log(chalk.gray(`    Triggers: ${spec.trigger.paths.join(", ")}`));
        }
      }
    }
  } catch (err: any) {
    console.error(chalk.red("✗ Failed to load specs: " + err.message));
    hasErrors = true;
  }

  // Check API key
  console.log("");
  if (process.env.ANTHROPIC_API_KEY) {
    console.log(chalk.green("✓") + " ANTHROPIC_API_KEY is set");
  } else {
    console.log(chalk.yellow("⚠ ANTHROPIC_API_KEY is not set — agents will fail at runtime"));
    console.log("  Set it with: " + chalk.cyan("export ANTHROPIC_API_KEY=sk-ant-..."));
  }

  // Check environment variables referenced in config
  if (config.environment?.preview_url) {
    const vars = [...config.environment.preview_url.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
    for (const v of vars) {
      if (process.env[v]) {
        console.log(chalk.green("✓") + ` ${v} is set`);
      } else {
        console.log(chalk.yellow(`⚠ ${v} is not set (used in preview_url)`));
      }
    }
  }

  console.log("");
  if (hasErrors) {
    console.log(chalk.red("Validation found issues."));
    process.exit(1);
  } else {
    console.log(chalk.green("All checks passed."));
  }
}
