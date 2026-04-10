import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { loadAllSpecs, analyzeChangedFiles } from "@agentqa/core";
import { SpecGeneratorAgent } from "@agentqa/agents";
import { GitTool, writeSpec, extractYamlBlocks } from "@agentqa/tools";
import { loadConfig } from "../config.js";
/**
 * Detect uncovered code changes and auto-generate spec suggestions.
 * Combines gap detection with spec generation in one step.
 */
export async function suggestCommand(rootDir = process.cwd(), options = {}) {
    const { since = "origin/main", dryRun = false, json = false } = options;
    const log = json ? (..._args) => { } : console.log;
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error(chalk.red("Error: ANTHROPIC_API_KEY environment variable is not set."));
        process.exit(1);
    }
    const config = await loadConfig(rootDir);
    const agentModel = config.model?.model ?? "claude-sonnet-4-20250514";
    const specsDir = path.join(rootDir, ".agentqa", "specs");
    const git = new GitTool(rootDir);
    const spinner = json
        ? { start: () => spinner, succeed: (_m) => { }, fail: (_m) => { }, text: "" }
        : ora("Analyzing gaps...").start();
    if (!json)
        spinner.start();
    // 1. Get changed files
    let changedFiles;
    let diffText;
    try {
        const [chResult, diffResult] = await Promise.all([
            git.listChangedFiles(since, "HEAD"),
            git.getDiff(since, "HEAD"),
        ]);
        changedFiles = chResult.files;
        diffText = diffResult.diff;
    }
    catch {
        try {
            const [chResult, diffResult] = await Promise.all([
                git.listChangedFiles(),
                git.getDiff(),
            ]);
            changedFiles = chResult.files;
            diffText = diffResult.diff;
        }
        catch (err) {
            spinner.fail(`Could not get diff: ${err.message}`);
            process.exit(1);
        }
    }
    if (changedFiles.length === 0) {
        spinner.succeed("No changes found.");
        return;
    }
    // 2. Load specs and find uncovered files
    let specEntries = [];
    try {
        specEntries = await loadAllSpecs(specsDir);
    }
    catch {
        // No specs yet — everything is uncovered
    }
    const analysis = analyzeChangedFiles(changedFiles, specEntries);
    const coveredFiles = new Set(analysis.matchedSpecs.flatMap(({ spec }) => changedFiles.filter(f => (spec.trigger.paths ?? []).some((p) => {
        const { minimatch } = require("minimatch");
        return minimatch(f, p);
    }))));
    const uncoveredFiles = changedFiles.filter(f => !coveredFiles.has(f));
    if (uncoveredFiles.length === 0) {
        spinner.succeed("All changed files are covered by existing specs.");
        if (json) {
            console.log(JSON.stringify({ suggestions: [], uncovered_files: [] }));
        }
        return;
    }
    spinner.succeed(`${uncoveredFiles.length} file(s) not covered by any spec`);
    // 3. Generate specs for uncovered code
    const genSpinner = json
        ? { start: () => genSpinner, succeed: (_m) => { }, fail: (_m) => { } }
        : ora("Generating spec suggestions...").start();
    if (!json)
        genSpinner.start();
    const truncatedDiff = diffText.length > 12000 ? diffText.substring(0, 12000) + "\n... (truncated)" : diffText;
    const context = `Generate AgentQA test specs for the following UNCOVERED code changes. These files have no existing specs covering them.

Uncovered files (${uncoveredFiles.length}):
${uncoveredFiles.map(f => `  - ${f}`).join("\n")}

Diff:
\`\`\`diff
${truncatedDiff}
\`\`\`

Focus on user-visible behavior. Generate specs with appropriate trigger paths so they'll run when these files change again.`;
    const agent = new SpecGeneratorAgent(agentModel);
    let agentOutput;
    try {
        agentOutput = await agent.generateFromContext(context);
    }
    catch (err) {
        genSpinner.fail(`Suggestion generation failed: ${err.message}`);
        process.exit(1);
    }
    const specs = extractYamlBlocks(agentOutput);
    if (specs.length === 0) {
        genSpinner.fail("No specs generated.");
        if (json) {
            console.log(JSON.stringify({ suggestions: [], uncovered_files: uncoveredFiles }));
        }
        return;
    }
    genSpinner.succeed(`Generated ${specs.length} spec suggestion(s)`);
    if (json) {
        console.log(JSON.stringify({
            suggestions: specs,
            uncovered_files: uncoveredFiles,
        }, null, 2));
        return;
    }
    if (dryRun) {
        log(chalk.bold("\nSuggested specs (dry run):\n"));
        const yamlLib = await import("js-yaml");
        for (const spec of specs) {
            log(chalk.cyan(`# ${spec.name ?? "untitled"}`));
            log(yamlLib.dump(spec, { lineWidth: 100, noRefs: true }));
        }
        log(chalk.gray("\n(Run without --dry-run to write specs to disk)"));
        return;
    }
    // Write specs to disk
    const written = [];
    for (const spec of specs) {
        try {
            const result = await writeSpec(specsDir, spec);
            written.push(result.filePath);
            log(chalk.green("✓") + ` Created ${chalk.cyan(result.filePath)}`);
        }
        catch (err) {
            log(chalk.yellow("⚠") + ` Skipped ${spec.name ?? "untitled"}: ${err.message}`);
        }
    }
    if (written.length > 0) {
        log(chalk.bold(`\n${written.length} spec(s) written. Run ${chalk.cyan("agentqa run")} to execute them.`));
    }
}
//# sourceMappingURL=suggest.js.map