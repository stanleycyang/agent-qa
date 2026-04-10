import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { loadAllSpecs, analyzeChangedFiles, mergeRankings } from "@agentqa/core";
import { LogicAgent } from "@agentqa/agents";
import { GitTool } from "@agentqa/tools";
import { loadConfig } from "../config.js";
import { runSpecsFiltered } from "./run.js";
export async function impactCommand(rootDir = process.cwd(), options = {}) {
    const { since = "origin/main", top = 5, dryRun = false, verbose = false, json = false } = options;
    const log = json ? (..._args) => { } : console.log;
    if (!dryRun && !process.env.ANTHROPIC_API_KEY) {
        console.error(chalk.red("Error: ANTHROPIC_API_KEY environment variable is not set."));
        process.exit(1);
    }
    const config = await loadConfig(rootDir);
    const specsDir = path.join(rootDir, ".agentqa", "specs");
    const agentModel = config.model?.model ?? "claude-sonnet-4-20250514";
    const spinner = json
        ? { start: () => spinner, succeed: (_m) => { }, fail: (_m) => { }, stop: () => { } }
        : ora("Analyzing diff...").start();
    if (!json)
        spinner.start();
    // 1. Get changed files and diff text
    const git = new GitTool();
    let changedFiles;
    let diffText;
    try {
        const { files } = await git.listChangedFiles(since, "HEAD");
        changedFiles = files;
        const { diff } = await git.getDiff(since, "HEAD");
        diffText = diff;
    }
    catch {
        // Fallback to unstaged changes
        const { files } = await git.listChangedFiles();
        changedFiles = files;
        const { diff } = await git.getDiff();
        diffText = diff;
    }
    if (changedFiles.length === 0) {
        spinner.succeed("No changed files detected.");
        return;
    }
    // 2. Load specs
    let specEntries;
    try {
        specEntries = await loadAllSpecs(specsDir);
    }
    catch {
        spinner.fail("Could not load specs.");
        process.exit(1);
    }
    if (specEntries.length === 0) {
        spinner.succeed("No specs found.");
        return;
    }
    // 3. Path-based matching (deterministic, fast)
    const pathHits = analyzeChangedFiles(changedFiles, specEntries);
    // 4. Semantic ranking (LLM one-shot, only if we have an API key)
    let semanticHits = [];
    if (process.env.ANTHROPIC_API_KEY) {
        try {
            const specDescriptions = specEntries.map(e => ({
                name: e.spec.name,
                description: e.spec.description ?? "",
                expectations: e.spec.scenarios.flatMap((s) => s.expect).slice(0, 5),
            }));
            // Truncate diff to ~2k chars to keep cost low
            const truncatedDiff = diffText.length > 2000 ? diffText.substring(0, 2000) + "\n... (truncated)" : diffText;
            const agent = new LogicAgent(agentModel);
            const prompt = `Given this git diff and list of test specs, rank which specs are most likely affected by the changes.

## Changed files
${changedFiles.join("\n")}

## Diff (truncated)
${truncatedDiff}

## Available specs
${JSON.stringify(specDescriptions, null, 2)}

Return a JSON array of the top ${top} most relevant specs:
[{ "name": "spec name", "score": 0.0-1.0, "reason": "brief reason" }]

Only include specs that are plausibly affected. Return an empty array if none are relevant.`;
            const result = await agent.runConversation("You are a test impact analyzer. Return only JSON, no tools needed.", prompt, { maxToolResultBytes: 0 });
            try {
                const match = result.match(/\[[\s\S]*\]/);
                if (match) {
                    semanticHits = JSON.parse(match[0]);
                }
            }
            catch {
                // Semantic ranking failed — proceed with path-only
            }
        }
        catch {
            // Semantic ranking failed — proceed with path-only
        }
    }
    // 5. Merge and rank
    const ranked = mergeRankings(pathHits, semanticHits, specEntries).slice(0, top);
    spinner.succeed(`Impact analysis: ${ranked.length} spec(s) at risk from ${changedFiles.length} changed file(s)`);
    if (ranked.length === 0) {
        log(chalk.green("\nNo specs are affected by the current diff."));
        return;
    }
    // Print ranked list
    log("");
    for (let i = 0; i < ranked.length; i++) {
        const r = ranked[i];
        const matchIcon = r.matchedBy === "path" ? "📁" : r.matchedBy === "semantic" ? "🧠" : "📁🧠";
        log(`  ${i + 1}. ${matchIcon} ${chalk.bold(r.spec.name)} ${chalk.gray(`(score: ${r.score.toFixed(2)})`)}`);
        for (const reason of r.reasons) {
            log(chalk.gray(`     → ${reason}`));
        }
    }
    if (dryRun) {
        log(chalk.gray("\n(dry run — not executing specs)"));
        return;
    }
    // 6. Run the impacted specs
    log(chalk.bold(`\nRunning ${ranked.length} impacted spec(s)...\n`));
    const filteredSpecs = ranked.map(r => ({ spec: r.spec, path: r.specPath }));
    const runOpts = {
        verbose,
        json,
        autoFix: options.autoFix,
    };
    const { results, costInfo, confidenceFloor } = await runSpecsFiltered(filteredSpecs, rootDir, runOpts, config);
    // Output
    const passed = results.reduce((sum, r) => sum + r.scenarios.filter(s => s.status === "pass").length, 0);
    const failed = results.reduce((sum, r) => sum + r.scenarios.filter(s => s.status !== "pass").length, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);
    if (json) {
        console.log(JSON.stringify({
            results,
            impact: ranked.map(r => ({ spec: r.spec.name, score: r.score, reasons: r.reasons, matchedBy: r.matchedBy })),
            summary: { passed, failed, total: passed + failed },
            duration_ms: totalDuration,
            cost: costInfo,
            confidence_floor: confidenceFloor,
        }, null, 2));
    }
    else {
        log("\n" + chalk.gray("━".repeat(40)));
        const passStr = chalk.green(`✅ ${passed} passed`);
        const failStr = failed > 0 ? chalk.red(`  ❌ ${failed} failed`) : "";
        const costStr = costInfo.usd > 0 ? chalk.gray(`  💰 $${costInfo.usd.toFixed(4)}`) : "";
        log(`${passStr}${failStr}  ${chalk.gray(`(total: ${(totalDuration / 1000).toFixed(1)}s)`)}${costStr}`);
    }
    if (failed > 0) {
        process.exit(1);
    }
}
//# sourceMappingURL=impact.js.map