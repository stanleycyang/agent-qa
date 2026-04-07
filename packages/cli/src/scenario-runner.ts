import * as fs from "fs/promises";
import * as path from "path";
import { AgentQASpec, Scenario, ScenarioResult, ViewportConfig, BrowserType } from "@agentqa/core";
import {
  UIAgent, APIAgent, LogicAgent, A11yAgent, SecurityAgent,
} from "@agentqa/agents";
import { BaselineStore } from "@agentqa/tools";

export interface ExecuteScenarioOptions {
  agentModel: string;
  rootDir: string;
  baselineStore: BaselineStore;
  updateBaselines?: boolean;
  screenshotOnFailure?: boolean;
  recordVideoOnFailure?: boolean;
  matrixViewport?: ViewportConfig;
  matrixBrowser?: BrowserType;
}

/**
 * Run a single scenario against the appropriate agent for its environment type.
 * Used by `agentqa run`, `agentqa fix`, and `agentqa bisect`.
 */
export async function executeScenario(
  spec: AgentQASpec,
  scenario: Scenario,
  envVars: Record<string, string>,
  options: ExecuteScenarioOptions,
): Promise<ScenarioResult> {
  const {
    agentModel,
    rootDir,
    baselineStore,
    updateBaselines = false,
    screenshotOnFailure = false,
    recordVideoOnFailure = false,
    matrixViewport,
    matrixBrowser,
  } = options;

  if (spec.environment.type === "web" || spec.environment.type === "a11y") {
    const AgentClass = spec.environment.type === "a11y" ? A11yAgent : UIAgent;
    const replayDir = recordVideoOnFailure
      ? path.join(rootDir, ".agentqa", "replays", `${sanitize(spec.name)}_${sanitize(scenario.name)}_${Date.now()}`)
      : undefined;
    if (replayDir) {
      await fs.mkdir(replayDir, { recursive: true });
    }
    const agent = new AgentClass({
      model: agentModel,
      baselineStore,
      specName: spec.name,
      updateBaselines,
      viewport: matrixViewport,
      browserType: matrixBrowser,
      recordVideoDir: replayDir,
    });
    await agent.initialize();
    let result: ScenarioResult | undefined;
    try {
      result = await agent.runScenario(scenario, envVars);
      if (screenshotOnFailure && result.status !== "pass") {
        try {
          const screenshotDir = path.join(rootDir, ".agentqa", "screenshots");
          await fs.mkdir(screenshotDir, { recursive: true });
          const matrixSuffix = matrixViewport || matrixBrowser
            ? `_${matrixViewport?.name ?? ""}${matrixBrowser ? "-" + matrixBrowser : ""}`
            : "";
          const filename = `${spec.name}_${scenario.name}${matrixSuffix}_${Date.now()}.png`.replace(/\s+/g, "-");
          const screenshotPath = path.join(screenshotDir, filename);
          await agent.captureScreenshot(screenshotPath);
          result.screenshots = [screenshotPath];
        } catch {
          // best-effort screenshot
        }
      }
      if (recordVideoOnFailure && replayDir && result.status !== "pass") {
        try {
          const browser = agent.getBrowser();
          await Promise.all([
            fs.writeFile(path.join(replayDir, "network.json"), JSON.stringify(browser.getNetworkLog(), null, 2)),
            fs.writeFile(path.join(replayDir, "console.json"), JSON.stringify(browser.getConsoleMessages(), null, 2)),
            fs.writeFile(path.join(replayDir, "trace.json"), JSON.stringify(result.trace ?? [], null, 2)),
          ]);
          result.network_path = path.join(replayDir, "network.json");
        } catch {
          // best-effort artifact write
        }
      }
      const healEvents = agent.getHealEvents();
      if (healEvents.length > 0) {
        result.healed_selectors = healEvents;
      }
    } finally {
      await agent.cleanup();
      if (recordVideoOnFailure && replayDir && result && result.status !== "pass") {
        try {
          const files = await fs.readdir(replayDir);
          const video = files.find(f => f.endsWith(".webm"));
          if (video) result.video_path = path.join(replayDir, video);
        } catch {
          // best-effort video lookup
        }
      }
    }
    return result!;
  }

  if (spec.environment.type === "api") {
    return new APIAgent(agentModel).runScenario(scenario, envVars);
  }
  if (spec.environment.type === "security") {
    return new SecurityAgent(agentModel).runScenario(scenario, envVars);
  }
  return new LogicAgent(agentModel).runScenario(scenario, envVars);
}

/** Substitute {{ENV_VAR}} placeholders with values from process.env. */
export function resolveEnv(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => process.env[key] ?? "");
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "-");
}
