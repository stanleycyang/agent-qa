import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { loadAllSpecs, analyzeChangedFiles } from "@agentqa/core";
import { GitTool } from "@agentqa/tools";
export async function gapsCommand(rootDir = process.cwd(), options = {}) {
    const specsDir = path.join(rootDir, ".agentqa", "specs");
    const ref = options.ref ?? "HEAD~1";
    const git = new GitTool(rootDir);
    const spinner = ora("Loading specs and diff...").start();
    let specEntries = [];
    try {
        specEntries = await loadAllSpecs(specsDir);
    }
    catch {
        specEntries = [];
    }
    let changedFiles;
    try {
        const result = await git.listChangedFiles(ref, "HEAD");
        changedFiles = result.files;
    }
    catch (err) {
        spinner.fail(`Could not get diff vs ${ref}: ${err.message}`);
        process.exit(1);
    }
    if (changedFiles.length === 0) {
        spinner.succeed(`No changes found vs ${ref}`);
        return;
    }
    const analysis = analyzeChangedFiles(changedFiles, specEntries);
    const matchedFiles = new Set();
    for (const { spec } of analysis.matchedSpecs) {
        if (!spec.trigger.paths)
            continue;
        for (const file of changedFiles) {
            for (const _ of spec.trigger.paths) {
                matchedFiles.add(file);
            }
        }
    }
    // For per-file matching we need to recheck which files match which specs
    const { minimatch } = await import("minimatch");
    const fileToSpecs = new Map();
    for (const file of changedFiles) {
        const matches = [];
        for (const { spec } of specEntries) {
            if (!spec.trigger.paths || spec.trigger.paths.length === 0) {
                matches.push(spec.name);
                continue;
            }
            if (spec.trigger.paths.some((p) => minimatch(file, p))) {
                matches.push(spec.name);
            }
        }
        fileToSpecs.set(file, matches);
    }
    const uncovered = changedFiles.filter(f => (fileToSpecs.get(f) ?? []).length === 0);
    const covered = changedFiles.filter(f => (fileToSpecs.get(f) ?? []).length > 0);
    spinner.succeed(`Analyzed ${changedFiles.length} changed file(s) against ${specEntries.length} spec(s)`);
    console.log("");
    console.log(chalk.bold("Coverage Report"));
    console.log(chalk.gray("─".repeat(50)));
    if (covered.length > 0) {
        console.log(chalk.green(`\n✓ ${covered.length} file(s) covered by existing specs:`));
        for (const file of covered) {
            const specs = fileToSpecs.get(file);
            console.log(`  ${chalk.green("✓")} ${file}`);
            console.log(chalk.gray(`    → ${specs.join(", ")}`));
        }
    }
    if (uncovered.length > 0) {
        console.log(chalk.yellow(`\n⚠ ${uncovered.length} file(s) not covered by any spec:`));
        for (const file of uncovered) {
            console.log(`  ${chalk.yellow("⚠")} ${file}`);
        }
        console.log("");
        console.log(chalk.bold("Suggested actions:"));
        console.log("  Generate specs for uncovered files:");
        console.log(chalk.cyan(`    agentqa generate --ref ${ref}`));
        console.log("  Or generate a spec for a specific file:");
        if (uncovered.length > 0) {
            console.log(chalk.cyan(`    agentqa generate ${uncovered[0]}`));
        }
        process.exit(1);
    }
    else {
        console.log(chalk.green("\n✅ All changed files are covered."));
    }
}
//# sourceMappingURL=gaps.js.map