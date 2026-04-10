import * as fs from "fs/promises";
import chalk from "chalk";
import { SpecResult } from "@agentqa/core";
import { ReporterAgent } from "@agentqa/agents";

export interface ReportOptions {
  input: string;
  out?: string;
}

/**
 * Read a JSON results file (from `agentqa run --json`) and produce a
 * markdown report. Intended for CI — the GitHub workflow pipes `agentqa
 * report --input results.json` instead of building markdown inline.
 */
export async function reportCommand(options: ReportOptions): Promise<void> {
  let raw: string;
  try {
    raw = await fs.readFile(options.input, "utf-8");
  } catch {
    console.error(chalk.red(`Could not read results file: ${options.input}`));
    process.exit(1);
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error(chalk.red("Invalid JSON in results file."));
    process.exit(1);
  }

  const results: SpecResult[] = data.results ?? [];
  const reporter = new ReporterAgent();

  const markdown = reporter.generateMarkdown(results, {
    totalCost: data.cost,
    confidenceFloor: data.confidence_floor,
    impact: data.impact,
  });

  if (options.out) {
    await fs.writeFile(options.out, markdown);
    console.log(chalk.green(`Report written to ${options.out}`));
  } else {
    console.log(markdown);
  }
}
