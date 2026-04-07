import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { loadAllSpecs } from "@agentqa/core";
import { GitTool, BaselineStore } from "@agentqa/tools";
import { loadConfig } from "../config.js";
import { executeScenario, resolveEnv } from "../scenario-runner.js";
export async function bisectCommand(scenarioName, rootDir = process.cwd(), options) {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error(chalk.red("Error: ANTHROPIC_API_KEY environment variable is not set."));
        process.exit(1);
    }
    if (!options.good) {
        console.error(chalk.red("Error: --good <ref> is required"));
        process.exit(1);
    }
    const config = await loadConfig(rootDir);
    const git = new GitTool(rootDir);
    const specsDir = path.join(rootDir, ".agentqa", "specs");
    const agentModel = config.model?.model ?? "claude-sonnet-4-20250514";
    const maxSteps = options.maxSteps ?? 20;
    const baselineStore = new BaselineStore(path.join(rootDir, ".agentqa", "baselines"));
    // Save current branch so we can restore it
    const originalBranch = (await git.getCurrentBranch()).branch;
    console.log(chalk.gray(`Current branch: ${originalBranch}`));
    // Find the scenario across all specs
    const specEntries = await loadAllSpecs(specsDir);
    let targetSpec = null;
    let targetScenario = null;
    for (const { spec } of specEntries) {
        const found = spec.scenarios.find(s => s.name.toLowerCase().includes(scenarioName.toLowerCase()));
        if (found) {
            targetSpec = spec;
            targetScenario = found;
            break;
        }
    }
    if (!targetSpec || !targetScenario) {
        console.error(chalk.red(`No scenario found matching "${scenarioName}"`));
        process.exit(1);
    }
    console.log(chalk.bold(`\n🔍 Bisecting "${targetScenario.name}" from ${targetSpec.name}`));
    console.log(chalk.gray(`Good ref: ${options.good}`));
    console.log(chalk.gray(`Bad ref: ${options.bad ?? "HEAD"}\n`));
    // Set up cleanup on interrupt
    let interrupted = false;
    const cleanup = async () => {
        if (interrupted)
            return;
        interrupted = true;
        console.log(chalk.gray("\n\nResetting bisect and restoring branch..."));
        await git.bisectReset();
        try {
            await git.checkout(originalBranch);
        }
        catch { }
        process.exit(130);
    };
    process.on("SIGINT", cleanup);
    try {
        await git.bisectStart(options.bad ?? "HEAD", options.good);
        let step = 0;
        while (step < maxSteps) {
            step++;
            const sha = await git.getCurrentSha();
            const info = await git.show(sha);
            const spinner = ora(`Step ${step}: testing ${sha.substring(0, 8)} (${info.message})`).start();
            let result;
            try {
                const envVars = {
                    base_url: resolveEnv(targetSpec.environment.base_url) ?? "",
                    api_url: resolveEnv(config.environment?.api_url) ?? "",
                };
                result = await executeScenario(targetSpec, targetScenario, envVars, {
                    agentModel,
                    rootDir,
                    baselineStore,
                });
            }
            catch (err) {
                spinner.fail(`Step ${step}: error during run — ${err.message}`);
                await git.bisectReset();
                await git.checkout(originalBranch);
                process.exit(1);
            }
            const passed = result.status === "pass";
            if (passed) {
                spinner.succeed(`Step ${step}: ${chalk.green("✅ pass")} at ${sha.substring(0, 8)}`);
            }
            else {
                spinner.fail(`Step ${step}: ${chalk.red("❌ fail")} at ${sha.substring(0, 8)}`);
            }
            const bisectResult = await git.bisectMark(passed ? "good" : "bad");
            if (bisectResult.done && bisectResult.sha) {
                const breakingInfo = await git.show(bisectResult.sha);
                console.log("");
                console.log(chalk.bold(chalk.red("🎯 Found the breaking commit:")));
                console.log(`  ${chalk.cyan(bisectResult.sha.substring(0, 12))} — ${breakingInfo.message}`);
                console.log(chalk.gray(`  Author: ${breakingInfo.author}`));
                console.log(chalk.gray(`  Date: ${breakingInfo.date}`));
                console.log(chalk.gray(`\n  View it: git show ${bisectResult.sha.substring(0, 12)}`));
                await git.bisectReset();
                await git.checkout(originalBranch);
                return;
            }
        }
        console.log(chalk.yellow(`\nReached max steps (${maxSteps}) without finding the breaking commit.`));
        await git.bisectReset();
        await git.checkout(originalBranch);
    }
    catch (err) {
        console.error(chalk.red(`\nBisect failed: ${err.message}`));
        await git.bisectReset();
        try {
            await git.checkout(originalBranch);
        }
        catch { }
        process.exit(1);
    }
}
//# sourceMappingURL=bisect.js.map