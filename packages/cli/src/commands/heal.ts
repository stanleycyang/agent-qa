import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { loadAllSpecs, ScenarioResult } from "@agentqa/core";
import { FixAgent } from "@agentqa/agents";
import { HistoryStore, BaselineStore } from "@agentqa/tools";
import { loadConfig } from "../config.js";
import { executeScenario, resolveEnv } from "../scenario-runner.js";

export interface HealOptions {
  threshold?: number;
  runs?: number;
  autoApply?: boolean;
}

/**
 * Find flaky scenarios, re-run them to observe the pattern,
 * then use FixAgent to diagnose and propose a fix.
 */
export async function healCommand(
  rootDir: string = process.cwd(),
  options: HealOptions = {},
): Promise<void> {
  const { threshold = 0.2, runs = 3, autoApply = false } = options;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(chalk.red("Error: ANTHROPIC_API_KEY environment variable is not set."));
    process.exit(1);
  }

  const config = await loadConfig(rootDir);
  const agentModel = config.model?.model ?? "claude-sonnet-4-20250514";
  const historyStore = new HistoryStore(path.join(rootDir, ".agentqa", "history.json"));
  const baselineStore = new BaselineStore(path.join(rootDir, ".agentqa", "baselines"));

  const spinner = ora("Analyzing history for flaky scenarios...").start();

  const stats = await historyStore.getAllStats();
  const flaky = stats.filter(s => s.rate >= threshold && s.rate < 0.9 && s.runs >= 5);

  if (flaky.length === 0) {
    spinner.succeed("No flaky scenarios found.");
    return;
  }

  spinner.succeed(`Found ${flaky.length} flaky scenario(s)`);

  for (const scenario of flaky) {
    console.log(chalk.bold(`\n🔬 ${scenario.spec} → ${scenario.scenario}`));
    console.log(chalk.gray(`   Failure rate: ${(scenario.rate * 100).toFixed(0)}% over ${scenario.runs} runs`));
    console.log(chalk.gray(`   Median duration: ${scenario.durations.length > 0 ? (scenario.durations[Math.floor(scenario.durations.length / 2)] / 1000).toFixed(1) + "s" : "n/a"}`));

    // Load the spec
    const specsDir = path.join(rootDir, ".agentqa", "specs");
    const specEntries = await loadAllSpecs(specsDir);
    const specEntry = specEntries.find(e => e.spec.name === scenario.spec);
    if (!specEntry) {
      console.log(chalk.yellow(`   ⚠ Spec "${scenario.spec}" not found — skipping`));
      continue;
    }

    const scenarioObj = specEntry.spec.scenarios.find(s => s.name === scenario.scenario);
    if (!scenarioObj) {
      console.log(chalk.yellow(`   ⚠ Scenario "${scenario.scenario}" not found in spec — skipping`));
      continue;
    }

    // Re-run N times to observe the pattern
    const rerunSpinner = ora(`   Running ${runs} times to observe pattern...`).start();
    const results: ScenarioResult[] = [];
    for (let i = 0; i < runs; i++) {
      try {
        const envVars: Record<string, string> = {
          base_url: resolveEnv(specEntry.spec.environment.base_url) ?? "",
          api_url: resolveEnv(config.environment?.api_url) ?? "",
        };
        const result = await executeScenario(specEntry.spec, scenarioObj, envVars, {
          agentModel,
          rootDir,
          baselineStore,
          screenshotOnFailure: true,
        });
        results.push(result);
      } catch (err: any) {
        results.push({
          scenario: scenario.scenario,
          status: "error",
          expectations: [],
          duration_ms: 0,
          error: err.message,
        });
      }
    }

    const passes = results.filter(r => r.status === "pass").length;
    const fails = results.filter(r => r.status !== "pass").length;
    rerunSpinner.succeed(`   ${passes}/${runs} passed, ${fails}/${runs} failed`);

    if (fails === 0) {
      console.log(chalk.green("   ✅ All runs passed — flakiness may have resolved"));
      continue;
    }
    if (passes === 0) {
      console.log(chalk.red("   ❌ All runs failed — this is a real bug, not flakiness"));
      continue;
    }

    // Use FixAgent to diagnose the flakiness pattern
    const diagSpinner = ora("   🔧 Diagnosing flakiness...").start();
    const failedResult = results.find(r => r.status !== "pass")!;
    const fixAgent = new FixAgent(agentModel);
    if (autoApply) fixAgent.enableWrites(rootDir);

    try {
      // Enrich context with flakiness pattern
      const enrichedResult = {
        ...failedResult,
        error: `FLAKY SCENARIO — ${passes}/${runs} passes, ${fails}/${runs} failures.
Pattern: ${results.map(r => r.status === "pass" ? "✅" : "❌").join(" ")}
Durations: ${results.map(r => `${(r.duration_ms / 1000).toFixed(1)}s`).join(", ")}
Historical failure rate: ${(scenario.rate * 100).toFixed(0)}% over ${scenario.runs} runs.

This is an intermittent failure. Diagnose whether it's:
1. A timing/race condition (fix: add wait conditions or increase timeouts in the spec)
2. Flaky test infrastructure (fix: improve selectors, add retries)
3. A real intermittent bug in the application (fix: the app code)

${failedResult.error ?? ""}`,
      };

      const proposal = await fixAgent.fixFailure(scenario.spec, enrichedResult);

      if (proposal.files.length > 0) {
        diagSpinner.succeed(`   🔧 Fix proposed (${(proposal.confidence * 100).toFixed(0)}% confidence)`);
        console.log(chalk.gray(`   ${proposal.summary}`));
        for (const file of proposal.files) {
          console.log(chalk.cyan(`   📄 ${file.path}`));
          console.log(chalk.gray(`      ${file.rationale}`));
        }
      } else {
        diagSpinner.succeed(chalk.gray(`   🔧 ${proposal.summary}`));
      }
    } catch (err: any) {
      diagSpinner.fail(`   Diagnosis failed: ${err.message}`);
    }
  }
}
