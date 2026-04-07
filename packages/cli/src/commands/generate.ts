import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { SpecGeneratorAgent } from "@agentqa/agents";
import { GitTool, writeSpec, extractYamlBlocks } from "@agentqa/tools";
import { loadConfig } from "../config.js";

export interface GenerateOptions {
  ref?: string;
  type?: "web" | "api" | "logic";
  out?: string;
  dryRun?: boolean;
  force?: boolean;
  fromFigma?: string;
  fromSentry?: string;
  fromIssue?: string;
}

export async function generateCommand(
  target: string | undefined,
  rootDir: string = process.cwd(),
  options: GenerateOptions = {},
): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(chalk.red("Error: ANTHROPIC_API_KEY environment variable is not set."));
    process.exit(1);
  }

  const config = await loadConfig(rootDir);
  const agentModel = config.model?.model ?? "claude-sonnet-4-20250514";
  const specsDir = options.out ?? path.join(rootDir, ".agentqa", "specs");

  const spinner = ora("Gathering context...").start();
  let context: string;

  try {
    if (options.fromFigma) {
      // Imported lazily to avoid loading Figma client when not used
      const { buildFigmaContext } = await import("./generate-from-figma.js");
      context = await buildFigmaContext(options.fromFigma, config);
    } else if (options.fromSentry) {
      const { buildSentryContext } = await import("./generate-from-sentry.js");
      context = await buildSentryContext(options.fromSentry, config);
    } else if (options.fromIssue) {
      const { buildIssueContext } = await import("./generate-from-issue.js");
      context = await buildIssueContext(options.fromIssue, config);
    } else {
      context = await buildDiffContext(target, options, rootDir);
    }
  } catch (err: any) {
    spinner.fail(err.message);
    process.exit(1);
  }

  spinner.text = "Generating specs (this may take a moment)...";

  const agent = new SpecGeneratorAgent(agentModel);
  let agentOutput: string;
  try {
    agentOutput = await agent.generateFromContext(context);
  } catch (err: any) {
    spinner.fail(`Spec generation failed: ${err.message}`);
    process.exit(1);
  }

  const specs = extractYamlBlocks(agentOutput);
  if (specs.length === 0) {
    spinner.fail("No valid specs in agent output");
    console.error(chalk.gray("Raw output:\n" + agentOutput.substring(0, 800)));
    process.exit(1);
  }

  spinner.succeed(`Generated ${specs.length} spec${specs.length !== 1 ? "s" : ""}`);

  if (options.dryRun) {
    console.log(chalk.bold("\nDry run — not writing files. Generated specs:\n"));
    for (const spec of specs) {
      console.log(chalk.cyan(`# ${(spec.name as string) ?? "untitled"}`));
      console.log(JSON.stringify(spec, null, 2));
      console.log();
    }
    return;
  }

  const written: Array<{ filePath: string; name: string }> = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  for (const spec of specs) {
    try {
      // Override environment.type if --type was specified
      if (options.type && typeof spec.environment === "object" && spec.environment) {
        (spec.environment as Record<string, unknown>).type = options.type;
      }
      const result = await writeSpec(specsDir, spec, { force: options.force });
      written.push(result);
    } catch (err: any) {
      skipped.push({ name: (spec.name as string) ?? "untitled", reason: err.message });
    }
  }

  console.log("");
  for (const w of written) {
    console.log(chalk.green("✓") + ` Created ${chalk.cyan(w.filePath)}`);
  }
  for (const s of skipped) {
    console.log(chalk.yellow("⚠") + ` Skipped ${s.name}: ${s.reason}`);
  }

  console.log("\nNext steps:");
  console.log("  1. Review the generated specs and adjust as needed");
  console.log("  2. Run " + chalk.cyan("agentqa validate") + " to verify");
  console.log("  3. Run " + chalk.cyan("agentqa run") + " to execute");
}

async function buildDiffContext(
  target: string | undefined,
  options: GenerateOptions,
  rootDir: string,
): Promise<string> {
  const git = new GitTool(rootDir);
  const ref = options.ref ?? "HEAD~1";

  let diff: string;
  let changedFiles: string[];

  if (target) {
    // User specified a target file/directory
    const fs = await import("fs/promises");
    try {
      const stat = await fs.stat(path.resolve(rootDir, target));
      if (stat.isFile()) {
        const content = await fs.readFile(path.resolve(rootDir, target), "utf-8");
        return `Generate AgentQA specs that test the behavior in this file:

File: ${target}

\`\`\`
${content}
\`\`\`

Read related files in the codebase to understand the full context, then output one or more YAML specs.`;
      }
    } catch {
      // Not a file path; treat as a description
    }
    return `Generate AgentQA specs for the following feature description:

${target}

Read relevant files in the codebase to understand the implementation, then output one or more YAML specs.`;
  }

  // Default: use git diff against the configured ref
  try {
    const diffResult = await git.getDiff(ref, "HEAD");
    diff = diffResult.diff;
    const changedResult = await git.listChangedFiles(ref, "HEAD");
    changedFiles = changedResult.files;
  } catch {
    // Fall back to unstaged changes
    const diffResult = await git.getDiff();
    diff = diffResult.diff;
    const changedResult = await git.listChangedFiles();
    changedFiles = changedResult.files;
  }

  if (!diff || changedFiles.length === 0) {
    throw new Error(`No changes found vs ${ref}. Use --ref to specify a different base.`);
  }

  return `Generate AgentQA test specs that would catch regressions in the following code changes.

Changed files (${changedFiles.length}):
${changedFiles.map(f => `  - ${f}`).join("\n")}

Diff:
\`\`\`diff
${diff.substring(0, 12000)}
\`\`\`

Read the relevant changed files to understand the full context, then output one or more YAML specs covering the new/changed behavior. Focus on user-visible behavior over implementation details.`;
}
