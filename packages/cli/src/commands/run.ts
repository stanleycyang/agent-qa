import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { loadAllSpecs, Orchestrator, SpecResult, Scenario, AgentQASpec } from "@agentqa/core";
import { UIAgent, APIAgent, LogicAgent, ReporterAgent } from "@agentqa/agents";
import { loadConfig } from "../config.js";

export async function runCommand(specName?: string, rootDir: string = process.cwd()): Promise<void> {
  const config = await loadConfig(rootDir);
  const specsDir = path.join(rootDir, ".agentqa", "specs");

  const spinner = ora("Loading specs...").start();

  let specEntries: Array<{ spec: AgentQASpec; path: string }>;
  try {
    specEntries = await loadAllSpecs(specsDir);
  } catch (err: any) {
    spinner.fail("Could not load specs from .agentqa/specs/");
    console.error(chalk.red(err.message));
    console.log("\nRun " + chalk.cyan("agentqa init") + " to set up your project.");
    process.exit(1);
  }

  // Filter by name if specified
  if (specName) {
    specEntries = specEntries.filter(
      ({ spec, path: specPath }) =>
        spec.name.toLowerCase() === specName.toLowerCase() ||
        specPath.split("/").pop()?.replace(/\.ya?ml$/, "") === specName
    );
    if (specEntries.length === 0) {
      spinner.fail(`No spec found matching "${specName}"`);
      process.exit(1);
    }
  }

  spinner.succeed(
    `Found ${specEntries.length} spec${specEntries.length !== 1 ? "s" : ""}: ${specEntries.map(e => e.spec.name).join(", ")}`
  );

  const allResults: SpecResult[] = [];
  const reporter = new ReporterAgent();

  for (const { spec } of specEntries) {
    console.log(`\n${chalk.bold(`🚀 Running ${spec.name}`)} (${spec.scenarios.length} scenarios)...`);

    const specStart = Date.now();
    const scenarioResults = [];

    for (const scenario of spec.scenarios) {
      const scenarioSpinner = ora(`  ${scenario.name}`).start();
      const scenarioStart = Date.now();

      try {
        const envVars: Record<string, string> = {
          base_url: resolveEnv(spec.environment.base_url) ?? "",
          api_url: resolveEnv(config.environment?.api_url) ?? "",
        };

        let result;
        const agentModel = config.model?.model ?? "claude-sonnet-4-20250514";

        if (spec.environment.type === "web") {
          const agent = new UIAgent(agentModel);
          await agent.initialize();
          result = await agent.runScenario(scenario, envVars);
          await agent.cleanup();
        } else if (spec.environment.type === "api") {
          const agent = new APIAgent(agentModel);
          result = await agent.runScenario(scenario, envVars);
        } else {
          const agent = new LogicAgent(agentModel);
          result = await agent.runScenario(scenario, envVars);
        }

        const duration = ((Date.now() - scenarioStart) / 1000).toFixed(1);

        if (result.status === "pass") {
          scenarioSpinner.succeed(
            chalk.green(`  ✅ ${scenario.name}`) + chalk.gray(` (${duration}s)`)
          );
        } else {
          scenarioSpinner.fail(
            chalk.red(`  ❌ ${scenario.name}`) + chalk.gray(` (${duration}s)`)
          );
          // Print failed expectations
          for (const exp of result.expectations) {
            if (exp.status === "fail") {
              console.log(chalk.gray(`     → Expected: "${exp.text}"`));
              if (exp.evidence) {
                console.log(chalk.gray(`     → Got: ${exp.evidence}`));
              }
            }
          }
        }

        scenarioResults.push(result);
      } catch (err: any) {
        const duration = ((Date.now() - scenarioStart) / 1000).toFixed(1);
        scenarioSpinner.fail(
          chalk.red(`  ❌ ${scenario.name}`) + chalk.gray(` (${duration}s)`)
        );
        console.log(chalk.gray(`     → Error: ${err.message}`));

        scenarioResults.push({
          scenario: scenario.name,
          status: "error" as const,
          expectations: scenario.expect.map(e => ({ text: e, status: "skip" as const })),
          duration_ms: Date.now() - scenarioStart,
          error: err.message,
        });
      }
    }

    const specStatus = scenarioResults.every(s => s.status === "pass") ? "pass" : "fail";
    allResults.push({
      spec: spec.name,
      scenarios: scenarioResults,
      status: specStatus as "pass" | "fail",
      duration_ms: Date.now() - specStart,
    });
  }

  // Summary
  const summary = reporter.generateSummary(allResults);
  const totalDuration = allResults.reduce((sum, r) => sum + r.duration_ms, 0);

  console.log("\n" + chalk.gray("━".repeat(40)));
  const passStr = chalk.green(`✅ ${summary.passed} passed`);
  const failStr = summary.failed > 0 ? chalk.red(`  ❌ ${summary.failed} failed`) : "";
  console.log(`${passStr}${failStr}  ${chalk.gray(`(total: ${(totalDuration / 1000).toFixed(1)}s)`)}`);

  if (summary.failed > 0) {
    process.exit(1);
  }
}

function resolveEnv(value?: string): string | undefined {
  if (!value) return undefined;
  // Resolve {{ENV_VAR}} patterns
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => process.env[key] ?? "");
}
