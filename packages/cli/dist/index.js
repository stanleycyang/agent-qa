#!/usr/bin/env node
import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { initCommand } from "./commands/init.js";
import { validateCommand } from "./commands/validate.js";
import { generateCommand } from "./commands/generate.js";
import { gapsCommand } from "./commands/gaps.js";
import * as path from "path";
const program = new Command();
program
    .name("agentqa")
    .description("Agent-driven testing framework — natural language specs, AI execution")
    .version("0.1.0");
program
    .command("run [spec]")
    .description("Run all specs or a named spec against the configured environment")
    .option("-d, --dir <path>", "Root directory of the project", process.cwd())
    .option("--verbose", "Show detailed agent traces and tool calls")
    .option("--json", "Output results as JSON (for CI)")
    .option("--dry-run", "Validate specs and show execution plan without running agents")
    .option("--watch", "Re-run specs on file changes")
    .option("--update-baselines", "Refresh visual regression baselines with current state")
    .action(async (specName, opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await runCommand(specName, rootDir, {
        verbose: opts?.verbose,
        json: opts?.json,
        dryRun: opts?.dryRun,
        watch: opts?.watch,
        updateBaselines: opts?.updateBaselines,
    });
});
program
    .command("init")
    .description("Initialize AgentQA in the current project")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .option("--force", "Overwrite existing files")
    .action(async (opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await initCommand(rootDir, opts?.force);
});
program
    .command("generate [target]")
    .description("Generate spec files automatically from git diff, a file, or an external source")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .option("--ref <ref>", "Git ref to compare against (default: HEAD~1)")
    .option("--type <type>", "Force environment type: web, api, or logic")
    .option("--out <path>", "Output directory for specs (default: .agentqa/specs)")
    .option("--dry-run", "Print specs without writing them to disk")
    .option("--force", "Overwrite existing spec files")
    .option("--from-figma <url>", "Generate specs from a Figma file or frame URL")
    .option("--from-sentry [issue]", "Generate specs from Sentry error issues")
    .option("--from-issue <url>", "Generate specs from a Linear or Jira issue URL")
    .action(async (target, opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await generateCommand(target, rootDir, {
        ref: opts?.ref,
        type: opts?.type,
        out: opts?.out,
        dryRun: opts?.dryRun,
        force: opts?.force,
        fromFigma: opts?.fromFigma,
        fromSentry: opts?.fromSentry,
        fromIssue: opts?.fromIssue,
    });
});
program
    .command("gaps")
    .description("Find changed files that aren't covered by any spec")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .option("--ref <ref>", "Git ref to compare against (default: HEAD~1)")
    .action(async (opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await gapsCommand(rootDir, { ref: opts?.ref });
});
program
    .command("validate")
    .description("Validate spec files and configuration")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .action(async (opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await validateCommand(rootDir);
});
program.parse(process.argv);
//# sourceMappingURL=index.js.map