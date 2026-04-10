import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { ExplainAgent } from "@agentqa/agents";
import { HistoryStore } from "@agentqa/tools";
import { loadConfig } from "../config.js";

export interface ExplainOptions {
  dir?: string;
  verbose?: boolean;
}

export async function explainCommand(
  failureId: string,
  rootDir: string = process.cwd(),
  options: ExplainOptions = {},
): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(chalk.red("Error: ANTHROPIC_API_KEY environment variable is not set."));
    process.exit(1);
  }

  const config = await loadConfig(rootDir);
  const agentModel = config.model?.model ?? "claude-sonnet-4-20250514";
  const historyStore = new HistoryStore(path.join(rootDir, ".agentqa", "history.json"));

  const spinner = ora("Looking up failure...").start();

  const entry = await historyStore.findEntry(failureId);
  if (!entry) {
    spinner.fail(`No failure found matching "${failureId}"`);
    console.log(chalk.gray("\nRecent failures:"));
    const recent = await historyStore.listRecentFailures(5);
    if (recent.length === 0) {
      console.log(chalk.gray("  (none — run some specs first)"));
    } else {
      for (const r of recent) {
        const id = `${r.spec}::${r.scenario}::${r.timestamp}`;
        const date = new Date(r.timestamp).toLocaleString();
        console.log(chalk.gray(`  ${r.status === "error" ? "⚠️" : "❌"} ${r.spec} → ${r.scenario} (${date})`));
        console.log(chalk.gray(`    ID: ${id}`));
      }
    }
    process.exit(1);
  }

  spinner.succeed(`Found: ${entry.spec} → ${entry.scenario} (${entry.status})`);

  const explainSpinner = ora("Investigating...").start();

  try {
    const agent = new ExplainAgent(agentModel, rootDir);
    const report = await agent.explain({
      spec: entry.spec,
      scenario: entry.scenario,
      status: entry.status,
      timestamp: entry.timestamp,
    });

    explainSpinner.succeed("Investigation complete\n");
    console.log(report);
  } catch (err: any) {
    explainSpinner.fail(`Investigation failed: ${err.message}`);
    process.exit(1);
  }
}
