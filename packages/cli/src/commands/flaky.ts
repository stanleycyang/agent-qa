import * as path from "path";
import chalk from "chalk";
import { HistoryStore } from "@agentqa/tools";

export async function flakyCommand(rootDir: string = process.cwd()): Promise<void> {
  const history = new HistoryStore(path.join(rootDir, ".agentqa", "history.json"));
  const entries = await history.load();

  if (entries.length === 0) {
    console.log(chalk.gray("No history yet. Run `agentqa run` a few times to build history."));
    return;
  }

  // Group entries by (spec, scenario)
  const groups = new Map<string, { spec: string; scenario: string; runs: number; failures: number; durations: number[] }>();
  for (const e of entries) {
    const key = `${e.spec}::${e.scenario}`;
    if (!groups.has(key)) {
      groups.set(key, { spec: e.spec, scenario: e.scenario, runs: 0, failures: 0, durations: [] });
    }
    const g = groups.get(key)!;
    g.runs++;
    if (e.status !== "pass") g.failures++;
    g.durations.push(e.duration_ms);
  }

  // Compute flakiness for each
  const flaky: Array<{ spec: string; scenario: string; rate: number; runs: number }> = [];
  for (const g of groups.values()) {
    if (g.runs < 5) continue;
    const rate = g.failures / g.runs;
    if (rate > 0.05 && rate < 0.95) {
      flaky.push({ spec: g.spec, scenario: g.scenario, rate, runs: g.runs });
    }
  }

  if (flaky.length === 0) {
    console.log(chalk.green("✅ No flaky scenarios detected."));
    console.log(chalk.gray(`(analyzed ${entries.length} runs across ${groups.size} scenarios)`));
    return;
  }

  flaky.sort((a, b) => b.rate - a.rate);

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
