#!/usr/bin/env node
import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { initCommand } from "./commands/init.js";
import { validateCommand } from "./commands/validate.js";
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
    .command("validate")
    .description("Validate spec files and configuration")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .action(async (opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await validateCommand(rootDir);
});
program.parse(process.argv);
//# sourceMappingURL=index.js.map