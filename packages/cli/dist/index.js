#!/usr/bin/env node
import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { initCommand } from "./commands/init.js";
import { validateCommand } from "./commands/validate.js";
import { generateCommand } from "./commands/generate.js";
import { gapsCommand } from "./commands/gaps.js";
import { flakyCommand } from "./commands/flaky.js";
import { bisectCommand } from "./commands/bisect.js";
import { fixCommand } from "./commands/fix.js";
import { reportCommand } from "./commands/report.js";
import { impactCommand } from "./commands/impact.js";
import { explainCommand } from "./commands/explain.js";
import { mcpCommand } from "./commands/mcp.js";
import { suggestCommand } from "./commands/suggest.js";
import { healCommand } from "./commands/heal.js";
import { recordCommand } from "./commands/record.js";
import { reproduceCommand } from "./commands/reproduce.js";
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
    .option("--auto-fix", "On failure, propose code fixes via FixAgent")
    .option("--no-cache", "Bypass smart caching and run all specs")
    .action(async (specName, opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await runCommand(specName, rootDir, {
        verbose: opts?.verbose,
        json: opts?.json,
        dryRun: opts?.dryRun,
        watch: opts?.watch,
        updateBaselines: opts?.updateBaselines,
        autoFix: opts?.autoFix,
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
    .command("bisect <scenario>")
    .description("Run git bisect to find the commit that broke a scenario")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .requiredOption("--good <ref>", "A git ref where the scenario passes")
    .option("--bad <ref>", "A git ref where the scenario fails (default: HEAD)")
    .option("--max-steps <n>", "Maximum bisect steps (default: 20)", v => parseInt(v, 10))
    .action(async (scenario, opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await bisectCommand(scenario, rootDir, {
        good: opts?.good,
        bad: opts?.bad,
        maxSteps: opts?.maxSteps,
    });
});
program
    .command("fix")
    .description("Re-run failing scenarios and propose fixes via the FixAgent")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .option("--spec <name>", "Only fix failures from a specific spec")
    .option("--auto-apply", "Apply proposed fixes directly (writes files)")
    .action(async (opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await fixCommand(rootDir, {
        spec: opts?.spec,
        autoApply: opts?.autoApply,
    });
});
program
    .command("flaky")
    .description("List flaky scenarios based on run history")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .action(async (opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await flakyCommand(rootDir);
});
program
    .command("suggest")
    .description("Detect uncovered code changes and auto-generate spec suggestions")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .option("--since <ref>", "Git ref to diff against (default: origin/main)")
    .option("--dry-run", "Show suggested specs without writing to disk")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await suggestCommand(rootDir, {
        since: opts?.since,
        dryRun: opts?.dryRun,
        json: opts?.json,
    });
});
program
    .command("impact")
    .description("Predict which specs are at risk from the current diff and run them")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .option("--since <ref>", "Git ref to diff against (default: origin/main)")
    .option("--top <n>", "Max number of specs to run", v => parseInt(v, 10))
    .option("--dry-run", "Show impact analysis without running specs")
    .option("--verbose", "Show detailed output")
    .option("--json", "Output results as JSON")
    .option("--auto-fix", "Propose fixes for failures")
    .action(async (opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await impactCommand(rootDir, {
        since: opts?.since,
        top: opts?.top,
        dryRun: opts?.dryRun,
        verbose: opts?.verbose,
        json: opts?.json,
        autoFix: opts?.autoFix,
    });
});
program
    .command("report")
    .description("Generate a markdown report from a JSON results file")
    .requiredOption("--input <path>", "Path to the agentqa results JSON file")
    .option("--out <path>", "Write report to a file instead of stdout")
    .action(async (opts) => {
    await reportCommand({ input: opts.input, out: opts.out });
});
program
    .command("explain <failure-id>")
    .description("Explain why a test scenario failed using forensic analysis of replay artifacts")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .option("--verbose", "Show detailed agent traces")
    .action(async (failureId, opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await explainCommand(failureId, rootDir, { verbose: opts?.verbose });
});
program
    .command("mcp")
    .description("Start AgentQA as an MCP server for other agents to call")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .action(async (opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await mcpCommand(rootDir);
});
program
    .command("heal")
    .description("Find flaky scenarios, diagnose them, and propose fixes")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .option("--threshold <n>", "Minimum flakiness rate to investigate (0-1, default: 0.2)", v => parseFloat(v))
    .option("--runs <n>", "Number of re-runs per flaky scenario (default: 3)", v => parseInt(v, 10))
    .option("--auto-apply", "Apply proposed fixes directly")
    .action(async (opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await healCommand(rootDir, {
        threshold: opts?.threshold,
        runs: opts?.runs,
        autoApply: opts?.autoApply,
    });
});
program
    .command("record")
    .description("Record a browser session and generate a spec from it")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .option("--url <url>", "Starting URL to navigate to")
    .option("--dry-run", "Show generated spec without writing to disk")
    .option("--out <dir>", "Output directory for specs")
    .action(async (opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await recordCommand(rootDir, {
        url: opts?.url,
        dryRun: opts?.dryRun,
        out: opts?.out,
    });
});
program
    .command("reproduce <source>")
    .description("Generate a regression spec from a Sentry issue or Linear/Jira URL and run it")
    .option("-d, --dir <path>", "Root directory", process.cwd())
    .option("--dry-run", "Generate spec without running it")
    .action(async (source, opts) => {
    const rootDir = path.resolve(opts?.dir ?? process.cwd());
    await reproduceCommand(source, rootDir, {
        dryRun: opts?.dryRun,
    });
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