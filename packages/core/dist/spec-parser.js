import { z } from "zod";
import * as yaml from "js-yaml";
import * as fs from "fs/promises";
import * as path from "path";
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
});
export async function parseSpec(filePath) {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = yaml.load(content);
    return AgentQASpecSchema.parse(parsed);
}
export async function parseConfig(configPath) {
    const content = await fs.readFile(configPath, "utf-8");
    const parsed = yaml.load(content);
    return AgentQAConfigSchema.parse(parsed);
}
export async function loadAllSpecs(specsDir) {
    const files = await fs.readdir(specsDir);
    const yamlFiles = files.filter(f => f.endsWith(".yaml") || f.endsWith(".yml"));
    const specs = await Promise.all(yamlFiles.map(async (file) => {
        const specPath = path.join(specsDir, file);
        const spec = await parseSpec(specPath);
        return { spec, path: specPath };
    }));
    return specs;
}
//# sourceMappingURL=spec-parser.js.map