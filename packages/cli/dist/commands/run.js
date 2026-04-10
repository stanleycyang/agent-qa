import * as path from "path";
import * as fs from "fs/promises";
import chalk from "chalk";
import ora from "ora";
import { loadAllSpecs, emptyUsage, mergeUsage, computeCost } from "@agentqa/core";
import { ReporterAgent, FixAgent } from "@agentqa/agents";
import { BaselineStore, HistoryStore } from "@agentqa/tools";
import { loadConfig } from "../config.js";
import { executeScenario, resolveEnv } from "../scenario-runner.js";
export { runSpecsFiltered };
export async function runCommand(specName, rootDir = process.cwd(), options = {}) {
    const { verbose = false, json = false, dryRun = false, watch = false } = options;
    const log = json ? (..._args) => { } : console.log;
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
                if (!trimmed || trimmed.startsWith("#"))
                    continue;
                const eqIndex = trimmed.indexOf("=");
                if (eqIndex === -1)
                    continue;
                const key = trimmed.substring(0, eqIndex).trim();
                const value = trimmed.substring(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        }
        catch {
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
async function runOnce(specName, rootDir, specsDir, config, options) {
    const { verbose = false, json = false, dryRun = false } = options;
    const log = json ? (..._args) => { } : console.log;
    const spinner = json
        ? { start: () => spinner, succeed: (_m) => { }, fail: (_m) => { }, stop: () => { } }
        : ora("Loading specs...").start();
    if (!json)
        spinner.start();
    let specEntries;
    try {
        specEntries = await loadAllSpecs(specsDir);
    }
    catch (err) {
        spinner.fail("Could not load specs from .agentqa/specs/");
        console.error(chalk.red(err.message));
        log("\nRun " + chalk.cyan("agentqa init") + " to set up your project.");
        process.exit(1);
    }
    // Filter by name if specified (substring match)
    if (specName) {
        const query = specName.toLowerCase();
        specEntries = specEntries.filter(({ spec, path: specPath }) => spec.name.toLowerCase().includes(query) ||
            specPath.split("/").pop()?.replace(/\.ya?ml$/, "").toLowerCase().includes(query));
        if (specEntries.length === 0) {
            spinner.fail(`No spec found matching "${specName}"`);
            process.exit(1);
        }
    }
    spinner.succeed(`Found ${specEntries.length} spec${specEntries.length !== 1 ? "s" : ""}: ${specEntries.map(e => e.spec.name).join(", ")}`);
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
    const reporter = new ReporterAgent();
    if (options.updateBaselines) {
        log(chalk.blue("📸 Baseline update mode — all baselines will be refreshed\n"));
    }
    const { results: allResults, costInfo, confidenceFloor } = await runSpecsFiltered(specEntries, rootDir, options, config);
    // Summary
    const summary = reporter.generateSummary(allResults);
    const totalDuration = allResults.reduce((sum, r) => sum + r.duration_ms, 0);
    if (json) {
        console.log(JSON.stringify({
            results: allResults,
            summary,
            duration_ms: totalDuration,
            cost: costInfo,
            confidence_floor: confidenceFloor,
        }, null, 2));
    }
    else {
        log("\n" + chalk.gray("━".repeat(40)));
        const passStr = chalk.green(`✅ ${summary.passed} passed`);
        const failStr = summary.failed > 0 ? chalk.red(`  ❌ ${summary.failed} failed`) : "";
        const costStr = costInfo.usd > 0
            ? chalk.gray(`  💰 $${costInfo.usd.toFixed(4)}`)
            : "";
        log(`${passStr}${failStr}  ${chalk.gray(`(total: ${(totalDuration / 1000).toFixed(1)}s)`)}${costStr}`);
    }
    if (summary.failed > 0) {
        process.exit(1);
    }
}
async function runSpecsConcurrently(specEntries, runConfig, log, config) {
    const { concurrency } = runConfig;
    if (concurrency <= 1 || specEntries.length <= 1) {
        // Sequential execution
        const results = [];
        for (const entry of specEntries) {
            results.push(await runSpec(entry, runConfig, log, config));
        }
        return results;
    }
    // Parallel execution with concurrency limit
    log(chalk.gray(`\nRunning up to ${concurrency} specs in parallel...\n`));
    const results = new Array(specEntries.length);
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
async function runSpec(entry, runConfig, log, config) {
    const { spec } = entry;
    const { timeoutMs, maxRetries, verbose, json, historyStore, perfThreshold, flakyThreshold } = runConfig;
    log(`\n${chalk.bold(`🚀 Running ${spec.name}`)} (${spec.scenarios.length} scenarios)...`);
    const specStart = Date.now();
    const scenarioResults = [];
    // Scenarios within a spec run sequentially (they may depend on each other).
    // Each scenario expands across the configured viewport × browser matrix.
    for (const scenario of spec.scenarios) {
        const matrix = expandMatrix(spec, scenario, config);
        for (const matrixEntry of matrix) {
            const matrixLabel = matrixEntry.viewport || matrixEntry.browser
                ? chalk.gray(` [${[matrixEntry.viewport?.name, matrixEntry.browser].filter(Boolean).join("/")}]`)
                : "";
            const scenarioSpinner = json
                ? { start: () => scenarioSpinner, succeed: (_m) => { }, fail: (_m) => { } }
                : ora(`  ${scenario.name}${matrixLabel}`).start();
            if (!json)
                scenarioSpinner.start();
            const scenarioStart = Date.now();
            try {
                const envVars = {
                    base_url: resolveEnv(spec.environment.base_url) ?? "",
                    api_url: resolveEnv(config.environment?.api_url) ?? "",
                };
                const result = await runWithRetries(() => executeScenario(spec, scenario, envVars, {
                    agentModel: runConfig.agentModel,
                    rootDir: runConfig.rootDir,
                    baselineStore: runConfig.baselineStore,
                    updateBaselines: runConfig.updateBaselines,
                    screenshotOnFailure: runConfig.screenshotOnFailure,
                    recordVideoOnFailure: runConfig.recordVideoOnFailure,
                    matrixViewport: matrixEntry.viewport,
                    matrixBrowser: matrixEntry.browser,
                }), maxRetries, scenario.name, timeoutMs, log);
                // Annotate with flaky and perf regression info from history
                const flakiness = await historyStore.getFlakiness(spec.name, scenario.name, 10);
                if (flakiness.runs >= 5 && flakiness.rate >= flakyThreshold && flakiness.rate < 0.9) {
                    result.flaky = flakiness;
                }
                const median = await historyStore.getMedianDuration(spec.name, scenario.name);
                if (median !== null && result.duration_ms > median * perfThreshold) {
                    result.perf_regression = {
                        baseline_ms: median,
                        current_ms: result.duration_ms,
                        ratio: result.duration_ms / median,
                    };
                }
                // Buffer in-memory; flushed once at the end of the run.
                await historyStore.appendBuffered({
                    spec: spec.name,
                    scenario: scenario.name,
                    status: result.status,
                    duration_ms: result.duration_ms,
                    timestamp: Date.now(),
                });
                const duration = ((Date.now() - scenarioStart) / 1000).toFixed(1);
                if (result.status === "pass") {
                    const flakyTag = result.flaky ? chalk.yellow(" 🟡 flaky") : "";
                    const perfTag = result.perf_regression
                        ? chalk.yellow(` ⚠ ${result.perf_regression.ratio.toFixed(1)}× slower than baseline`)
                        : "";
                    scenarioSpinner.succeed(chalk.green(`  ✅ ${scenario.name}`) + chalk.gray(` (${duration}s)`) + flakyTag + perfTag);
                }
                else {
                    scenarioSpinner.fail(chalk.red(`  ❌ ${scenario.name}`) + chalk.gray(` (${duration}s)`));
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
                // Auto-fix: on failure, invoke FixAgent to propose a patch
                if (result.status !== "pass" && runConfig.autoFix) {
                    const fixSpinner = json
                        ? { start: () => fixSpinner, succeed: (_m) => { }, fail: (_m) => { } }
                        : ora(`     🔧 Investigating fix...`).start();
                    if (!json)
                        fixSpinner.start();
                    try {
                        const fixAgent = new FixAgent(runConfig.agentModel);
                        const proposal = await fixAgent.fixFailure(spec.name, result, {
                            mode: runConfig.autoFixMode,
                            minConfidence: runConfig.autoFixMinConfidence,
                            maxFiles: runConfig.autoFixMaxFiles,
                            maxLines: runConfig.autoFixMaxLines,
                            rootDir: runConfig.rootDir,
                        });
                        result.proposedFix = proposal;
                        if (proposal.files.length > 0) {
                            const tag = proposal.oversized ? " (oversized)" : "";
                            fixSpinner.succeed(chalk.cyan(`     🔧 Fix proposed (${(proposal.confidence * 100).toFixed(0)}% confidence, ${proposal.files.length} file(s))${tag}`));
                            if (!json)
                                log(chalk.gray(`        ${proposal.summary}`));
                        }
                        else {
                            fixSpinner.succeed(chalk.gray(`     🔧 No fix proposed — ${proposal.summary}`));
                        }
                    }
                    catch (err) {
                        fixSpinner.fail(chalk.gray(`     🔧 Fix investigation failed: ${err.message}`));
                    }
                }
                scenarioResults.push(result);
            }
            catch (err) {
                const duration = ((Date.now() - scenarioStart) / 1000).toFixed(1);
                scenarioSpinner.fail(chalk.red(`  ❌ ${scenario.name}`) + chalk.gray(` (${duration}s)`));
                log(chalk.gray(`     → Error: ${err.message}`));
                scenarioResults.push({
                    scenario: scenario.name,
                    status: "error",
                    expectations: scenario.expect.map(e => ({ text: e, status: "skip" })),
                    duration_ms: Date.now() - scenarioStart,
                    error: err.message,
                });
            }
        }
    }
    const specStatus = scenarioResults.every(s => s.status === "pass") ? "pass" : "fail";
    return {
        spec: spec.name,
        scenarios: scenarioResults,
        status: specStatus,
        duration_ms: Date.now() - specStart,
    };
}
/** Expand a single scenario into the configured viewport × browser matrix. */
function expandMatrix(spec, scenario, config) {
    if (spec.environment.type !== "web") {
        return [{}];
    }
    const viewports = config.execution?.viewports?.length
        ? config.execution.viewports
        : [undefined];
    const browsers = config.execution?.browsers?.length
        ? config.execution.browsers
        : [undefined];
    if (viewports.length === 1 && viewports[0] === undefined &&
        browsers.length === 1 && browsers[0] === undefined) {
        return [{}];
    }
    const matrix = [];
    for (const viewport of viewports) {
        for (const browser of browsers) {
            matrix.push({ viewport, browser });
        }
    }
    return matrix;
}
function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Scenario "${label}" timed out after ${ms / 1000}s`)), ms);
        promise
            .then(resolve)
            .catch(reject)
            .finally(() => clearTimeout(timer));
    });
}
async function runWithRetries(fn, retries, scenarioName, timeoutMs, log) {
    let lastResult;
    const maxAttempts = 1 + retries;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        lastResult = await withTimeout(fn(), timeoutMs, scenarioName);
        if (lastResult.status !== "error" || attempt === maxAttempts) {
            return lastResult;
        }
        log(chalk.yellow(`  ↻ Retrying ${scenarioName} (attempt ${attempt + 1}/${maxAttempts})...`));
    }
    return lastResult;
}
/**
 * Public entry point for running a pre-filtered set of specs.
 * Used by `agentqa impact` and `agentqa run` to share the same execution pipeline.
 */
async function runSpecsFiltered(specEntries, rootDir, options, config) {
    const { verbose = false, json = false } = options;
    const log = json ? (..._args) => { } : console.log;
    const timeoutMs = (config.execution?.timeout_per_scenario ?? 120) * 1000;
    const maxRetries = config.execution?.retries ?? 0;
    const screenshotOnFailure = config.execution?.screenshot_on_failure ?? false;
    const concurrency = config.execution?.concurrency ?? 1;
    const agentModel = config.model?.model ?? "claude-sonnet-4-20250514";
    const perfThreshold = config.execution?.perf_regression_threshold ?? 2.0;
    const flakyThreshold = config.execution?.flaky_threshold ?? 0.3;
    const recordVideoOnFailure = config.execution?.record_video_on_failure ?? false;
    const baselineStore = new BaselineStore(path.join(rootDir, ".agentqa", "baselines"));
    const historyStore = new HistoryStore(path.join(rootDir, ".agentqa", "history.json"));
    const autoFixConfig = config.auto_fix ?? {};
    const autoFix = options.autoFix || autoFixConfig.enabled === true;
    let allResults;
    try {
        allResults = await runSpecsConcurrently(specEntries, {
            timeoutMs, maxRetries, screenshotOnFailure, agentModel, rootDir,
            concurrency, verbose, json, baselineStore, historyStore,
            perfThreshold, flakyThreshold, recordVideoOnFailure,
            updateBaselines: options.updateBaselines ?? false,
            autoFix,
            autoFixMode: autoFixConfig.mode ?? "propose",
            autoFixMinConfidence: autoFixConfig.min_confidence ?? 0.8,
            autoFixMaxFiles: autoFixConfig.max_files ?? 3,
            autoFixMaxLines: autoFixConfig.max_lines ?? 50,
        }, log, config);
    }
    finally {
        await historyStore.flush();
    }
    // Aggregate cost + confidence
    const minConfidenceFloor = config.execution?.min_confidence ?? 0;
    let totalUsage = emptyUsage();
    let confidenceFloor = 1.0;
    for (const specResult of allResults) {
        for (const sr of specResult.scenarios) {
            if (sr.tokenUsage) {
                totalUsage = mergeUsage(totalUsage, sr.tokenUsage);
            }
            for (const exp of sr.expectations) {
                if (exp.confidence !== undefined && exp.status === "pass") {
                    confidenceFloor = Math.min(confidenceFloor, exp.confidence);
                }
                if (minConfidenceFloor > 0 && exp.confidence !== undefined && exp.confidence < minConfidenceFloor && exp.status === "pass") {
                    exp.low_confidence = true;
                }
            }
        }
    }
    const totalCostUsd = computeCost(totalUsage, agentModel);
    const costInfo = {
        input_tokens: totalUsage.input_tokens,
        output_tokens: totalUsage.output_tokens,
        usd: Math.round(totalCostUsd * 10000) / 10000,
    };
    return { results: allResults, costInfo, confidenceFloor };
}
// --- Watch mode ---
async function runWatchMode(specName, rootDir, specsDir, config, options) {
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
    }
    catch {
        // Fall back to watching specs dir only
    }
    console.log(chalk.gray(`Watching: ${watchPaths.join(", ")}`));
    console.log(chalk.gray("Waiting for changes...\n"));
    // Use fs.watch (no external dependency needed)
    let debounceTimer = null;
    let isRunning = false;
    const triggerRun = () => {
        if (debounceTimer)
            clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            if (isRunning)
                return;
            isRunning = true;
            console.log(chalk.blue("\n🔄 Change detected, re-running...\n"));
            try {
                await runOnce(specName, rootDir, specsDir, config, { ...options, watch: false });
            }
            catch {
                // Don't exit on failure in watch mode
            }
            isRunning = false;
            console.log(chalk.gray("\nWaiting for changes..."));
        }, 500);
    };
    const watchers = [];
    const fsSync = await import("fs");
    for (const watchPath of watchPaths) {
        try {
            const watcher = fsSync.watch(watchPath, { recursive: true }, () => triggerRun());
            watchers.push(watcher);
        }
        catch {
            // Directory might not exist
        }
    }
    // Keep process alive until Ctrl+C
    await new Promise((resolve) => {
        process.on("SIGINT", () => {
            for (const w of watchers)
                w.close();
            console.log(chalk.gray("\n\nWatch mode stopped."));
            resolve();
        });
    });
}
//# sourceMappingURL=run.js.map