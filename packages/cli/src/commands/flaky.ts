import * as path from "path";
import chalk from "chalk";
import { HistoryStore } from "@agentqa/tools";

const MIN_RUNS = 5;
const MIN_RATE = 0.05;
const MAX_RATE = 0.95;

export async function flakyCommand(rootDir: string = process.cwd()): Promise<void> {
  const history = new HistoryStore(path.join(rootDir, ".agentqa", "history.json"));
  const stats = await history.getAllStats();

  if (stats.length === 0) {
    console.log(chalk.gray("No history yet. Run `agentqa run` a few times to build history."));
    return;
  }

  const flaky = stats
    .filter(s => s.runs >= MIN_RUNS && s.rate > MIN_RATE && s.rate < MAX_RATE)
    .sort((a, b) => b.rate - a.rate);

  if (flaky.length === 0) {
    console.log(chalk.green("✅ No flaky scenarios detected."));
    console.log(chalk.gray(`(analyzed ${stats.reduce((n, s) => n + s.runs, 0)} runs across ${stats.length} scenarios)`));
    return;
  }

  console.log(chalk.bold(`🟡 ${flaky.length} flaky scenario(s):\n`));
  for (const f of flaky) {
    const pct = (f.rate * 100).toFixed(0);
    console.log(`  ${chalk.yellow("🟡")} ${chalk.cyan(f.spec)} → ${f.scenario}`);
    console.log(chalk.gray(`     ${pct}% failure rate over ${f.runs} runs`));
  }
  console.log(chalk.gray(`\nFlaky tests indicate non-determinism. Common fixes:`));
  console.log(chalk.gray(`  - Add wait_for_selector after navigation/actions`));
  console.log(chalk.gray(`  - Mock unstable network requests`));
  console.log(chalk.gray(`  - Use deterministic test data instead of random values`));
}
