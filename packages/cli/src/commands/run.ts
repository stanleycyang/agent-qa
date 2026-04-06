import * as path from "path";
import * as fs from "fs/promises";
import chalk from "chalk";
import ora from "ora";
import { loadAllSpecs, SpecResult, Scenario, AgentQASpec, ScenarioResult } from "@agentqa/core";
import { UIAgent, APIAgent, LogicAgent, ReporterAgent } from "@agentqa/agents";
import { BaselineStore } from "@agentqa/tools";
import { loadConfig } from "../config.js";

export interface RunOptions {
  dir?: string;
  verbose?: boolean;
  json?: boolean;
  dryRun?: boolean;
  watch?: boolean;
  updateBaselines?: boolean;
}

export async function runCommand(specName?: string, rootDir: string = process.cwd(), options: RunOptions = {}): Promise<void> {
  const { verbose = false, json = false, dryRun = false, watch = false } = options;
  const log = json ? (..._args: unknown[]) => {} : console.log;

  // Check for API key upfront (skip for dry-run)
  if (!dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error(chalk.red("Error: ANTHROPIC_API_KEY environment variable is not set."));
    console.error("Set it with: " + chalk.cyan("export ANTHROPIC_API_KEY=sk-ant-..."));
    process.exit(1);
  }

  const config = await loadConfig(rootDir);
  const specsDir = path.join(rootDir, ".agentqa", "specs");

  // Load env_file if configured
  if (config.environment?.env_file) {
    const envFilePath = path.resolve(rootDir, config.environment.env_file);
    try {
      const envContent = await fs.readFile(envFilePath, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      if (!json) {
        console.warn(chalk.yellow(`Warning: env_file "${config.environment.env_file}" not found, skipping.`));
      }
    }
  }

  if (watch) {
    await runWatchMode(specName, rootDir, specsDir, config, options);
    return;
  }

  await runOnce(specName, rootDir, specsDir, config, options);
}

async function runOnce(
  specName: string | undefined,
  rootDir: string,
  specsDir: string,
  config: Awaited<ReturnType<typeof loadConfig>>,
  options: RunOptions,
): Promise<void> {
  const { verbose = false, json = false, dryRun = false } = options;
  const log = json ? (..._args: unknown[]) => {} : console.log;

  const spinner = json
    ? { start: () => spinner, succeed: (_m?: string) => {}, fail: (_m?: string) => {}, stop: () => {} }
    : ora("Loading specs...").start();
  if (!json) (spinner as ReturnType<typeof ora>).start();

  let specEntries: Array<{ spec: AgentQASpec; path: string }>;
  try {
    specEntries = await loadAllSpecs(specsDir);
  } catch (err: any) {
    spinner.fail("Could not load specs from .agentqa/specs/");
    console.error(chalk.red(err.message));
    log("\nRun " + chalk.cyan("agentqa init") + " to set up your project.");
    process.exit(1);
  }

  // Filter by name if specified (substring match)
  if (specName) {
    const query = specName.toLowerCase();
    specEntries = specEntries.filter(
      ({ spec, path: specPath }) =>
        spec.name.toLowerCase().includes(query) ||
        specPath.split("/").pop()?.replace(/\.ya?ml$/, "").toLowerCase().includes(query)
    );
    if (specEntries.length === 0) {
      spinner.fail(`No spec found matching "${specName}"`);
      process.exit(1);
    }
  }

  spinner.succeed(
    `Found ${specEntries.length} spec${specEntries.length !== 1 ? "s" : ""}: ${specEntries.map(e => e.spec.name).join(", ")}`
  );

  // Dry-run mode: print plan and exit
  if (dryRun) {
    log(chalk.bold("\nExecution Plan (dry run):"));
    for (const { spec } of specEntries) {
      log(`\n  ${chalk.cyan(spec.name)} [${spec.environment.type}]`);
      if (spec.environment.base_url) {
        log(chalk.gray(`    base_url: ${resolveEnv(spec.environment.base_url)}`));
      }
      for (const scenario of spec.scenarios) {
        log(`    - ${scenario.name} (${scenario.expect.length} expectations)`);
      }
    }
    log(chalk.green("\nAll specs valid. Ready to run."));
    return;
  }

  const timeoutMs = (config.execution?.timeout_per_scenario ?? 120) * 1000;
  const maxRetries = config.execution?.retries ?? 0;
  const screenshotOnFailure = config.execution?.screenshot_on_failure ?? false;
  const concurrency = config.execution?.concurrency ?? 1;
  const agentModel = config.model?.model ?? "claude-sonnet-4-20250514";
  const baselineStore = new BaselineStore(path.join(rootDir, ".agentqa", "baselines"));
  const reporter = new ReporterAgent();

  if (options.updateBaselines) {
    log(chalk.blue("📸 Baseline update mode — all baselines will be refreshed\n"));
  }

  // Run specs with concurrency
  const allResults: SpecResult[] = await runSpecsConcurrently(
    specEntries,
    {
      timeoutMs,
      maxRetries,
      screenshotOnFailure,
      agentModel,
      rootDir,
      concurrency,
      verbose,
      json,
      baselineStore,
      updateBaselines: options.updateBaselines ?? false,
    },
    log,
    config,
  );

  // Summary
  const summary = reporter.generateSummary(allResults);
  const totalDuration = allResults.reduce((sum, r) => sum + r.duration_ms, 0);

  if (json) {
    console.log(JSON.stringify({ results: allResults, summary, duration_ms: totalDuration }, null, 2));
  } else {
    log("\n" + chalk.gray("━".repeat(40)));
    const passStr = chalk.green(`✅ ${summary.passed} passed`);
    const failStr = summary.failed > 0 ? chalk.red(`  ❌ ${summary.failed} failed`) : "";
    log(`${passStr}${failStr}  ${chalk.gray(`(total: ${(totalDuration / 1000).toFixed(1)}s)`)}`);
  }

  if (summary.failed > 0) {
    process.exit(1);
  }
}

interface RunConfig {
  timeoutMs: number;
  maxRetries: number;
  screenshotOnFailure: boolean;
  agentModel: string;
  rootDir: string;
  concurrency: number;
  verbose: boolean;
  json: boolean;
  baselineStore: BaselineStore;
  updateBaselines: boolean;
}

async function runSpecsConcurrently(
  specEntries: Array<{ spec: AgentQASpec; path: string }>,
  runConfig: RunConfig,
  log: (...args: unknown[]) => void,
  config: Awaited<ReturnType<typeof loadConfig>>,
): Promise<SpecResult[]> {
  const { concurrency } = runConfig;

  if (concurrency <= 1 || specEntries.length <= 1) {
    // Sequential execution
    const results: SpecResult[] = [];
    for (const entry of specEntries) {
      results.push(await runSpec(entry, runConfig, log, config));
    }
    return results;
  }

  // Parallel execution with concurrency limit
  log(chalk.gray(`\nRunning up to ${concurrency} specs in parallel...\n`));
  const results: SpecResult[] = new Array(specEntries.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, specEntries.length) }, async () => {
    while (nextIndex < specEntries.length) {
      const idx = nextIndex++;
      results[idx] = await runSpec(specEntries[idx], runConfig, log, config);
    }
  });

  await Promise.all(workers);
  return results;
}

async function runSpec(
  entry: { spec: AgentQASpec; path: string },
  runConfig: RunConfig,
  log: (...args: unknown[]) => void,
  config: Awaited<ReturnType<typeof loadConfig>>,
): Promise<SpecResult> {
  const { spec } = entry;
  const { timeoutMs, maxRetries, verbose, json } = runConfig;

  log(`\n${chalk.bold(`🚀 Running ${spec.name}`)} (${spec.scenarios.length} scenarios)...`);

  const specStart = Date.now();
  const scenarioResults: ScenarioResult[] = [];

  // Scenarios within a spec run sequentially (they may depend on each other)
  for (const scenario of spec.scenarios) {
    const scenarioSpinner = json
      ? { start: () => scenarioSpinner, succeed: (_m?: string) => {}, fail: (_m?: string) => {} }
      : ora(`  ${scenario.name}`).start();
    if (!json) (scenarioSpinner as ReturnType<typeof ora>).start();
    const scenarioStart = Date.now();

    try {
      const envVars: Record<string, string> = {
        base_url: resolveEnv(spec.environment.base_url) ?? "",
        api_url: resolveEnv(config.environment?.api_url) ?? "",
      };

      const result = await runWithRetries(
        () => executeScenario(spec, scenario, envVars, runConfig),
        maxRetries,
        scenario.name,
        timeoutMs,
        log,
      );

      const duration = ((Date.now() - scenarioStart) / 1000).toFixed(1);

      if (result.status === "pass") {
        scenarioSpinner.succeed(
          chalk.green(`  ✅ ${scenario.name}`) + chalk.gray(` (${duration}s)`)
        );
      } else {
        scenarioSpinner.fail(
          chalk.red(`  ❌ ${scenario.name}`) + chalk.gray(` (${duration}s)`)
        );
        for (const exp of result.expectations) {
          if (exp.status === "fail") {
            log(chalk.gray(`     → Expected: "${exp.text}"`));
            if (exp.evidence) {
              log(chalk.gray(`     → Got: ${exp.evidence}`));
            }
          }
        }
        if (result.screenshots?.length) {
          log(chalk.gray(`     → Screenshot: ${result.screenshots[0]}`));
        }
      }

      if (verbose && result.trace?.length) {
        log(chalk.gray(`     Tool calls:`));
        for (const tc of result.trace) {
          log(chalk.gray(`       • ${tc.tool}(${JSON.stringify(tc.input).substring(0, 80)})`));
        }
      }

      scenarioResults.push(result);
    } catch (err: any) {
      const duration = ((Date.now() - scenarioStart) / 1000).toFixed(1);
      scenarioSpinner.fail(
        chalk.red(`  ❌ ${scenario.name}`) + chalk.gray(` (${duration}s)`)
      );
      log(chalk.gray(`     → Error: ${err.message}`));

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
  return {
    spec: spec.name,
    scenarios: scenarioResults,
    status: specStatus as "pass" | "fail",
    duration_ms: Date.now() - specStart,
  };
}

async function executeScenario(
  spec: AgentQASpec,
  scenario: Scenario,
  envVars: Record<string, string>,
  runConfig: RunConfig,
): Promise<ScenarioResult> {
  const { agentModel, screenshotOnFailure, rootDir, baselineStore, updateBaselines } = runConfig;

  if (spec.environment.type === "web") {
    const agent = new UIAgent({
      model: agentModel,
      baselineStore,
      specName: spec.name,
      updateBaselines,
    });
    await agent.initialize();
    try {
      const result = await agent.runScenario(scenario, envVars);
      if (screenshotOnFailure && result.status !== "pass") {
        try {
          const screenshotDir = path.join(rootDir, ".agentqa", "screenshots");
          await fs.mkdir(screenshotDir, { recursive: true });
          const filename = `${spec.name}_${scenario.name}_${Date.now()}.png`.replace(/\s+/g, "-");
          const screenshotPath = path.join(screenshotDir, filename);
          await agent.captureScreenshot(screenshotPath);
          result.screenshots = [screenshotPath];
        } catch {
          // Screenshot capture is best-effort
        }
      }
      return result;
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Scenario "${label}" timed out after ${ms / 1000}s`)), ms);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

async function runWithRetries(
  fn: () => Promise<ScenarioResult>,
  retries: number,
  scenarioName: string,
  timeoutMs: number,
  log: (...args: unknown[]) => void,
): Promise<ScenarioResult> {
  let lastResult: ScenarioResult | undefined;
  const maxAttempts = 1 + retries;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await withTimeout(fn(), timeoutMs, scenarioName);

    if (lastResult.status !== "error" || attempt === maxAttempts) {
      return lastResult;
    }

    log(chalk.yellow(`  ↻ Retrying ${scenarioName} (attempt ${attempt + 1}/${maxAttempts})...`));
  }

  return lastResult!;
}

// --- Watch mode ---

async function runWatchMode(
  specName: string | undefined,
  rootDir: string,
  specsDir: string,
  config: Awaited<ReturnType<typeof loadConfig>>,
  options: RunOptions,
): Promise<void> {
  console.log(chalk.blue("👀 Watch mode — press Ctrl+C to stop\n"));

  // Run once immediately
  await runOnce(specName, rootDir, specsDir, config, { ...options, watch: false }).catch(() => {
    // Don't exit on failure in watch mode
  });

  // Collect paths to watch
  const watchPaths = [specsDir];

  // Also watch trigger paths from specs
  try {
    const specEntries = await loadAllSpecs(specsDir);
    for (const { spec } of specEntries) {
      if (spec.trigger.paths) {
        for (const triggerPath of spec.trigger.paths) {
          // Convert glob base to a watchable directory
          const base = triggerPath.split("*")[0].replace(/\/$/, "") || ".";
          const fullPath = path.resolve(rootDir, base);
          if (!watchPaths.includes(fullPath)) {
            watchPaths.push(fullPath);
          }
        }
      }
    }
  } catch {
    // Fall back to watching specs dir only
  }

  console.log(chalk.gray(`Watching: ${watchPaths.join(", ")}`));
  console.log(chalk.gray("Waiting for changes...\n"));

  // Use fs.watch (no external dependency needed)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isRunning = false;

  const triggerRun = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (isRunning) return;
      isRunning = true;
      console.log(chalk.blue("\n🔄 Change detected, re-running...\n"));
      try {
        await runOnce(specName, rootDir, specsDir, config, { ...options, watch: false });
      } catch {
        // Don't exit on failure in watch mode
      }
      isRunning = false;
      console.log(chalk.gray("\nWaiting for changes..."));
    }, 500);
  };

  const watchers: Array<ReturnType<typeof import("fs").watch>> = [];
  const fsSync = await import("fs");

  for (const watchPath of watchPaths) {
    try {
      const watcher = fsSync.watch(watchPath, { recursive: true }, () => triggerRun());
      watchers.push(watcher);
    } catch {
      // Directory might not exist
    }
  }

  // Keep process alive until Ctrl+C
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      for (const w of watchers) w.close();
      console.log(chalk.gray("\n\nWatch mode stopped."));
      resolve();
    });
  });
}

function resolveEnv(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => process.env[key] ?? "");
}
