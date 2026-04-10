import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { chromium } from "playwright";
import { SpecGeneratorAgent } from "@agentqa/agents";
import { writeSpec, extractYamlBlocks } from "@agentqa/tools";
import { loadConfig } from "../config.js";
/**
 * Interactive spec authoring: open a browser, user clicks through a flow,
 * agent watches and writes a spec from the captured actions.
 */
export async function recordCommand(rootDir = process.cwd(), options = {}) {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error(chalk.red("Error: ANTHROPIC_API_KEY environment variable is not set."));
        process.exit(1);
    }
    const config = await loadConfig(rootDir);
    const agentModel = config.model?.model ?? "claude-sonnet-4-20250514";
    const specsDir = options.out ?? path.join(rootDir, ".agentqa", "specs");
    console.log(chalk.bold("🎬 AgentQA Record Mode"));
    console.log(chalk.gray("Navigate through your app. When you're done, close the browser window.\n"));
    // Launch browser in headed mode
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        recordVideo: { dir: path.join(rootDir, ".agentqa", "replays", `recording-${Date.now()}`) },
    });
    // Capture actions
    const actions = [];
    const networkLog = [];
    const consoleLog = [];
    const page = await context.newPage();
    // Track navigations
    page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) {
            actions.push({ type: "navigate", timestamp: Date.now(), detail: frame.url() });
        }
    });
    // Track network requests
    page.on("request", (req) => {
        const entry = { method: req.method(), url: req.url() };
        networkLog.push(entry);
    });
    page.on("response", (resp) => {
        const entry = networkLog.find(e => e.url === resp.url() && !e.status);
        if (entry)
            entry.status = resp.status();
    });
    // Track console
    page.on("console", (msg) => {
        consoleLog.push({ type: msg.type(), text: msg.text() });
    });
    // Navigate to starting URL if provided
    if (options.url) {
        await page.goto(options.url, { waitUntil: "networkidle" });
        console.log(chalk.green(`✓ Navigated to ${options.url}`));
    }
    else {
        console.log(chalk.gray("Open a URL in the browser to start recording."));
    }
    console.log(chalk.gray("Waiting for browser to close...\n"));
    // Wait for browser to close (user closes the window)
    await new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
            try {
                // Check if the page/context is still open
                const pages = context.pages();
                if (pages.length === 0) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }
            catch {
                clearInterval(checkInterval);
                resolve();
            }
        }, 500);
        process.on("SIGINT", () => {
            clearInterval(checkInterval);
            resolve();
        });
    });
    // Take final screenshot before cleanup
    let finalScreenshotBase64 = "";
    try {
        const pages = context.pages();
        if (pages.length > 0) {
            const buf = await pages[0].screenshot({ fullPage: true });
            finalScreenshotBase64 = buf.toString("base64");
        }
    }
    catch {
        // Page may already be closed
    }
    await context.close();
    await browser.close();
    console.log(chalk.green("\n✓ Recording complete"));
    console.log(chalk.gray(`  ${actions.length} navigation(s), ${networkLog.length} network request(s)`));
    if (actions.length === 0) {
        console.log(chalk.yellow("No actions recorded. Nothing to generate."));
        return;
    }
    // Build context for spec generation
    const spinner = ora("Generating spec from recording...").start();
    const actionSummary = actions
        .map(a => `[${new Date(a.timestamp).toISOString()}] ${a.type}: ${a.detail}`)
        .join("\n");
    const apiCalls = networkLog
        .filter(n => !n.url.includes("chrome-extension") && !n.url.startsWith("data:"))
        .slice(-30)
        .map(n => `${n.method} ${n.url} → ${n.status ?? "pending"}`)
        .join("\n");
    const errors = consoleLog
        .filter(c => c.type === "error")
        .map(c => c.text)
        .join("\n");
    const context_prompt = `Generate an AgentQA spec from this recorded browser session.

## User Actions
${actionSummary}

## API Calls (last 30)
${apiCalls || "(none)"}

## Console Errors
${errors || "(none)"}

${finalScreenshotBase64 ? "A final screenshot of the page was captured." : ""}

Generate a spec that reproduces this user flow. Use descriptive step names in plain English.
Set appropriate trigger paths based on the URLs and API endpoints observed.`;
    const agent = new SpecGeneratorAgent(agentModel);
    let output;
    try {
        output = await agent.generateFromContext(context_prompt);
    }
    catch (err) {
        spinner.fail(`Spec generation failed: ${err.message}`);
        return;
    }
    const specs = extractYamlBlocks(output);
    if (specs.length === 0) {
        spinner.fail("No specs generated from recording.");
        return;
    }
    spinner.succeed(`Generated ${specs.length} spec(s) from recording`);
    if (options.dryRun) {
        const yamlLib = await import("js-yaml");
        for (const spec of specs) {
            console.log(chalk.cyan(`\n# ${spec.name ?? "untitled"}`));
            console.log(yamlLib.dump(spec, { lineWidth: 100, noRefs: true }));
        }
        return;
    }
    for (const spec of specs) {
        try {
            const result = await writeSpec(specsDir, spec);
            console.log(chalk.green("✓") + ` Created ${chalk.cyan(result.filePath)}`);
        }
        catch (err) {
            console.log(chalk.yellow("⚠") + ` Skipped: ${err.message}`);
        }
    }
}
//# sourceMappingURL=record.js.map