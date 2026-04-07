import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { loadAllSpecs, AgentQASpec, ScenarioResult } from "@agentqa/core";
import { UIAgent, APIAgent, LogicAgent, FixAgent } from "@agentqa/agents";
import { BaselineStore } from "@agentqa/tools";
import { loadConfig } from "../config.js";

export interface FixOptions {
  spec?: string;
  autoApply?: boolean;
}

export async function fixCommand(
  rootDir: string = process.cwd(),
  options: FixOptions = {},
): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(chalk.red("Error: ANTHROPIC_API_KEY environment variable is not set."));
    process.exit(1);
  }

  const config = await loadConfig(rootDir);
  const specsDir = path.join(rootDir, ".agentqa", "specs");
  const agentModel = config.model?.model ?? "claude-sonnet-4-20250514";

  const spinner = ora("Loading specs...").start();
  const specEntries = await loadAllSpecs(specsDir);
  const filtered = options.spec
    ? specEntries.filter(e => e.spec.name.toLowerCase().includes(options.spec!.toLowerCase()))
    : specEntries;
  spinner.succeed(`Running ${filtered.length} spec(s) to find failures...`);

  // Run each scenario, collect failures
  const failures: Array<{ spec: string; result: ScenarioResult }> = [];
  for (const { spec } of filtered) {
    for (const scenario of spec.scenarios) {
      const scenarioSpinner = ora(`  ${spec.name} → ${scenario.name}`).start();
      try {
        const result = await runOneScenario(spec, scenario, agentModel, rootDir, config);
        if (result.status !== "pass") {
          scenarioSpinner.fail(chalk.red(`  ❌ ${spec.name} → ${scenario.name}`));
          failures.push({ spec: spec.name, result });
        } else {
          scenarioSpinner.succeed(chalk.green(`  ✅ ${spec.name} → ${scenario.name}`));
        }
      } catch (err: any) {
        scenarioSpinner.fail(chalk.red(`  ❌ ${spec.name} → ${scenario.name} (${err.message})`));
        failures.push({
          spec: spec.name,
          result: {
            scenario: scenario.name,
            status: "error",
            expectations: [],
            duration_ms: 0,
            error: err.message,
          },
        });
      }
    }
  }

  if (failures.length === 0) {
    console.log(chalk.green("\n✅ No failures to fix."));
    return;
  }

  console.log(chalk.bold(`\n🔧 ${failures.length} failure(s) — investigating fixes...\n`));

  // For each failure, ask FixAgent to propose a fix
  for (const failure of failures) {
    console.log(chalk.cyan(`\n━━━ ${failure.spec} → ${failure.result.scenario} ━━━`));
    const fixSpinner = ora("Investigating...").start();
    const fixAgent = new FixAgent(agentModel);
    if (options.autoApply) {
      fixAgent.enableWrites(rootDir);
    }
    try {
      const proposal = await fixAgent.fixFailure(failure.spec, failure.result);
      fixSpinner.succeed("Investigation complete");
      console.log(proposal);
      if (!options.autoApply) {
        console.log(chalk.gray("\n(Re-run with --auto-apply to let the agent apply fixes directly)"));
      }
    } catch (err: any) {
      fixSpinner.fail(`Investigation failed: ${err.message}`);
    }
  }
}

async function runOneScenario(
  spec: AgentQASpec,
  scenario: any,
  agentModel: string,
  rootDir: string,
  config: any,
): Promise<ScenarioResult> {
  const envVars: Record<string, string> = {
    base_url: resolveEnv(spec.environment.base_url) ?? "",
    api_url: resolveEnv(config.environment?.api_url) ?? "",
  };

  if (spec.environment.type === "web") {
    const baselineStore = new BaselineStore(path.join(rootDir, ".agentqa", "baselines"));
    const agent = new UIAgent({ model: agentModel, baselineStore, specName: spec.name });
    await agent.initialize();
    try {
      return await agent.runScenario(scenario, envVars);
    } finally {
      await agent.cleanup();
    }
  } else if (spec.environment.type === "api") {
    const agent = new APIAgent(agentModel);
    return agent.runScenario(scenario, envVars);
  } else {
    const agent = new LogicAgent(agentModel);
    return agent.runScenario(scenario, envVars);
  }
}

function resolveEnv(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => process.env[key] ?? "");
}
