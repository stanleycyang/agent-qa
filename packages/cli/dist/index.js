#!/usr/bin/env node
import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { initCommand } from "./commands/init.js";
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
    .action(async (specName, opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await runCommand(specName, rootDir);
});
program
    .command("init")
    .description("Initialize AgentQA in the current project")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .action(async (opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await initCommand(rootDir);
});
program.parse(process.argv);
//# sourceMappingURL=index.js.map