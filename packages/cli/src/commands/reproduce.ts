import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { SpecGeneratorAgent } from "@agentqa/agents";
import { writeSpec, extractYamlBlocks } from "@agentqa/tools";
import { loadConfig } from "../config.js";
import { runSpecsFiltered } from "./run.js";
import { loadAllSpecs } from "@agentqa/core";

export interface ReproduceOptions {
  dryRun?: boolean;
}

/**
 * Generate a regression spec from a Sentry issue ID or Linear/Jira URL,
 * then immediately run it to verify the bug reproduces.
 */
export async function reproduceCommand(
  source: string,
  rootDir: string = process.cwd(),
  options: ReproduceOptions = {},
): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(chalk.red("Error: ANTHROPIC_API_KEY environment variable is not set."));
    process.exit(1);
  }

  const config = await loadConfig(rootDir);
  const agentModel = config.model?.model ?? "claude-sonnet-4-20250514";
  const specsDir = path.join(rootDir, ".agentqa", "specs");

  const spinner = ora("Fetching issue context...").start();

  // Detect source type and build context
  let context: string;
  let sourceLabel: string;
  try {
    if (source.includes("linear.app") || source.includes("atlassian.net") || source.includes("/browse/")) {
      const { buildIssueContext } = await import("./generate-from-issue.js");
      context = await buildIssueContext(source, config);
      sourceLabel = "issue";
    } else {
      // Assume Sentry issue ID
      const { buildSentryContext } = await import("./generate-from-sentry.js");
      context = await buildSentryContext(source, config);
      sourceLabel = "Sentry issue";
    }
  } catch (err: any) {
    spinner.fail(`Could not fetch ${source}: ${err.message}`);
    process.exit(1);
  }

  spinner.succeed(`Fetched ${sourceLabel} context`);

  // Generate regression spec
  const genSpinner = ora("Generating regression spec...").start();
  const agent = new SpecGeneratorAgent(agentModel);
  let output: string;
  try {
    output = await agent.generateFromContext(context);
  } catch (err: any) {
    genSpinner.fail(`Spec generation failed: ${err.message}`);
    process.exit(1);
  }

  const specs = extractYamlBlocks(output);
  if (specs.length === 0) {
    genSpinner.fail("No specs generated.");
    process.exit(1);
  }

  genSpinner.succeed(`Generated ${specs.length} regression spec(s)`);

  if (options.dryRun) {
    const yamlLib = await import("js-yaml");
    for (const spec of specs) {
      console.log(chalk.cyan(`\n# ${(spec.name as string) ?? "untitled"}`));
      console.log(yamlLib.dump(spec, { lineWidth: 100, noRefs: true }));
    }
    return;
  }

  // Write specs to disk
  const written: string[] = [];
  for (const spec of specs) {
    try {
      const safeName = `regression-${Date.now()}`;
      const result = await writeSpec(specsDir, spec, { filename: `${safeName}.yaml` });
      written.push(result.filePath);
      console.log(chalk.green("✓") + ` Created ${chalk.cyan(result.filePath)}`);
    } catch (err: any) {
      console.log(chalk.yellow("⚠") + ` Skipped: ${err.message}`);
    }
  }

  if (written.length === 0) {
    console.log(chalk.red("No specs written. Cannot reproduce."));
    process.exit(1);
  }

  // Run the regression specs
  console.log(chalk.bold("\n🔬 Running regression spec(s)...\n"));

  const specEntries = await loadAllSpecs(specsDir);
  const regressionSpecs = specEntries.filter(e =>
    written.some(w => w === e.path)
  );

  if (regressionSpecs.length === 0) {
    console.log(chalk.yellow("Could not load regression specs for execution."));
    return;
  }

  const { results } = await runSpecsFiltered(regressionSpecs, rootDir, {}, config);

  const failed = results.some(r => r.status !== "pass");
  if (failed) {
    console.log(chalk.red("\n🐛 Bug reproduced! Regression spec saved for future prevention."));
  } else {
    console.log(chalk.green("\n✅ Could not reproduce the bug — all scenarios passed."));
    console.log(chalk.gray("The regression spec has been saved. It will catch the bug if it recurs."));
  }
}
