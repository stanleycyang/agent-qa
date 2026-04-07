import { z } from "zod";
import * as yaml from "js-yaml";
import * as fs from "fs/promises";
import * as path from "path";
import { AgentQASpec, AgentQAConfig } from "./types.js";

const SpecTriggerSchema = z.object({
  paths: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
});

const SpecEnvironmentSchema = z.object({
  type: z.enum(["web", "api", "logic"]),
  base_url: z.string().optional(),
  setup: z.array(z.object({ seed: z.string() })).optional(),
});

const ScenarioSchema = z.object({
  name: z.string(),
  steps: z.array(z.string()).optional(),
  review: z.array(z.string()).optional(),
  expect: z.array(z.string()),
  on_failure: z.enum(["screenshot", "trace", "both"]).optional(),
});

const AgentQASpecSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  trigger: SpecTriggerSchema,
  environment: SpecEnvironmentSchema,
  scenarios: z.array(ScenarioSchema),
});

const ViewportSchema = z.object({
  name: z.string(),
  width: z.number(),
  height: z.number(),
});

const AgentQAConfigSchema = z.object({
  version: z.number(),
  model: z.object({
    provider: z.string().optional(),
    model: z.string().optional(),
    vision_model: z.string().optional(),
  }).optional(),
  execution: z.object({
    concurrency: z.number().optional(),
    timeout_per_scenario: z.number().optional(),
    retries: z.number().optional(),
    screenshot_on_failure: z.boolean().optional(),
    viewports: z.array(ViewportSchema).optional(),
    browsers: z.array(z.enum(["chromium", "firefox", "webkit"])).optional(),
    flaky_threshold: z.number().optional(),
    perf_regression_threshold: z.number().optional(),
    record_video_on_failure: z.boolean().optional(),
  }).optional(),
  environment: z.object({
    preview_url: z.string().optional(),
    api_url: z.string().optional(),
    env_file: z.string().optional(),
  }).optional(),
  reporting: z.object({
    github_comment: z.boolean().optional(),
    github_status: z.boolean().optional(),
    verbose: z.boolean().optional(),
    artifact_screenshots: z.boolean().optional(),
  }).optional(),
  integrations: z.object({
    figma_token: z.string().optional(),
    sentry_token: z.string().optional(),
    sentry_org: z.string().optional(),
    sentry_project: z.string().optional(),
    linear_token: z.string().optional(),
    jira_token: z.string().optional(),
    jira_host: z.string().optional(),
    jira_email: z.string().optional(),
  }).optional(),
});

export async function parseSpec(filePath: string): Promise<AgentQASpec> {
  const content = await fs.readFile(filePath, "utf-8");
  const parsed = yaml.load(content);
  return AgentQASpecSchema.parse(parsed);
}

export async function parseConfig(configPath: string): Promise<AgentQAConfig> {
  const content = await fs.readFile(configPath, "utf-8");
  const parsed = yaml.load(content);
  return AgentQAConfigSchema.parse(parsed);
}

export async function loadAllSpecs(specsDir: string): Promise<Array<{ spec: AgentQASpec; path: string }>> {
  const files = await fs.readdir(specsDir);
  const yamlFiles = files.filter(f => f.endsWith(".yaml") || f.endsWith(".yml"));

  if (yamlFiles.length === 0) {
    return [];
  }

  const specs: Array<{ spec: AgentQASpec; path: string }> = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const file of yamlFiles) {
    const specPath = path.join(specsDir, file);
    try {
      const spec = await parseSpec(specPath);
      specs.push({ spec, path: specPath });
    } catch (err: any) {
      errors.push({ file, error: err.message });
      console.warn(`Warning: skipping invalid spec ${file}: ${err.message}`);
    }
  }

  if (specs.length === 0 && errors.length > 0) {
    throw new Error(
      `All spec files failed to parse:\n${errors.map(e => `  - ${e.file}: ${e.error}`).join("\n")}`
    );
  }

  return specs;
}
