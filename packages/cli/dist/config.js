import { parseConfig } from "@agentqa/core";
import * as path from "path";
import * as fs from "fs/promises";
export async function loadConfig(rootDir = process.cwd()) {
    const configPath = path.join(rootDir, ".agentqa", "config.yaml");
    try {
        await fs.access(configPath);
        return await parseConfig(configPath);
    }
    catch {
        // Return default config if not found
        return {
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
    }
}
//# sourceMappingURL=config.js.map