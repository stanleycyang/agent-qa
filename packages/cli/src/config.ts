import { parseConfig, AgentQAConfig } from "@agentqa/core";
import * as path from "path";
import * as fs from "fs/promises";

const DEFAULT_CONFIG: AgentQAConfig = {
  version: 1,
  model: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    vision_model: "claude-sonnet-4-20250514",
  },
  execution: {
    concurrency: 3,
    timeout_per_scenario: 120,
    retries: 1,
    screenshot_on_failure: true,
  },
  reporting: {
    github_comment: false,
    github_status: false,
    verbose: false,
    artifact_screenshots: true,
  },
};

export async function loadConfig(rootDir: string = process.cwd()): Promise<AgentQAConfig> {
  const configPath = path.join(rootDir, ".agentqa", "config.yaml");

  try {
    await fs.access(configPath);
  } catch {
    // Config file does not exist — use defaults silently
    return DEFAULT_CONFIG;
  }

  try {
    return await parseConfig(configPath);
  } catch (err: any) {
    console.warn(
      `\x1b[33mWarning: could not parse .agentqa/config.yaml: ${err.message}. Using defaults.\x1b[0m`
    );
    return DEFAULT_CONFIG;
  }
}
