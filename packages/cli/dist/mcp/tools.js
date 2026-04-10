import * as path from "path";
import { z } from "zod";
import { loadAllSpecs } from "@agentqa/core";
import { loadConfig } from "../config.js";
import { executeScenario, resolveEnv } from "../scenario-runner.js";
import { BaselineStore, HistoryStore } from "@agentqa/tools";
/**
 * Register all AgentQA tools on an MCP server instance.
 * Each tool wraps existing CLI internals so logic isn't forked.
 */
export function registerTools(server, rootDir) {
    const specsDir = path.join(rootDir, ".agentqa", "specs");
    // --- list_specs ---
    server.tool("list_specs", "List all available AgentQA spec files with their scenarios and expectations.", {}, async () => {
        try {
            const specEntries = await loadAllSpecs(specsDir);
            const specs = specEntries.map(({ spec, path: specPath }) => ({
                name: spec.name,
                path: specPath,
                description: spec.description ?? "",
                environment: spec.environment.type,
                scenarios: spec.scenarios.map(s => ({
                    name: s.name,
                    expectations: s.expect,
                })),
            }));
            return { content: [{ type: "text", text: JSON.stringify(specs, null, 2) }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: `Error loading specs: ${err.message}` }], isError: true };
        }
    });
    // --- run_spec ---
    server.tool("run_spec", "Run a specific AgentQA spec (or a single scenario within it) and return results.", {
        spec: z.string().describe("Spec name (substring match)"),
        scenario: z.string().optional().describe("Optional scenario name to run (substring match)"),
    }, async ({ spec: specName, scenario: scenarioName }) => {
        try {
            const config = await loadConfig(rootDir);
            const agentModel = config.model?.model ?? "claude-sonnet-4-20250514";
            const specEntries = await loadAllSpecs(specsDir);
            const query = specName.toLowerCase();
            const matched = specEntries.filter(e => e.spec.name.toLowerCase().includes(query));
            if (matched.length === 0) {
                return { content: [{ type: "text", text: `No spec found matching "${specName}"` }], isError: true };
            }
            const baselineStore = new BaselineStore(path.join(rootDir, ".agentqa", "baselines"));
            const results = [];
            for (const { spec } of matched) {
                let scenarios = spec.scenarios;
                if (scenarioName) {
                    const sq = scenarioName.toLowerCase();
                    scenarios = scenarios.filter(s => s.name.toLowerCase().includes(sq));
                }
                for (const scenario of scenarios) {
                    const envVars = {
                        base_url: resolveEnv(spec.environment.base_url) ?? "",
                    };
                    const result = await executeScenario(spec, scenario, envVars, {
                        agentModel,
                        rootDir,
                        baselineStore,
                    });
                    results.push({ spec: spec.name, ...result });
                }
            }
            return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: `Error running spec: ${err.message}` }], isError: true };
        }
    });
    // --- run_impact ---
    server.tool("run_impact", "Analyze the current git diff to predict which specs are at risk, then run them.", {
        since: z.string().optional().describe("Git ref to diff against (default: origin/main)"),
        top: z.number().optional().describe("Max number of specs to run (default: 5)"),
        dry_run: z.boolean().optional().describe("If true, only show impact analysis without running"),
    }, async ({ since, top, dry_run }) => {
        try {
            // Use dynamic import to avoid circular deps
            const { impactCommand } = await import("../commands/impact.js");
            // Capture output by temporarily redirecting console
            const output = [];
            const origLog = console.log;
            console.log = (...args) => output.push(args.map(String).join(" "));
            try {
                await impactCommand(rootDir, {
                    since: since ?? "origin/main",
                    top: top ?? 5,
                    dryRun: dry_run ?? false,
                    json: true,
                });
            }
            catch {
                // impactCommand calls process.exit on failure — catch it
            }
            console.log = origLog;
            return { content: [{ type: "text", text: output.join("\n") }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    });
    // --- explain_failure ---
    server.tool("explain_failure", "Analyze a failed test scenario and explain the root cause in plain English.", {
        failure_id: z.string().describe("Failure ID: 'last' for most recent, or 'spec::scenario::timestamp'"),
    }, async ({ failure_id }) => {
        try {
            const { ExplainAgent } = await import("@agentqa/agents");
            const historyStore = new HistoryStore(path.join(rootDir, ".agentqa", "history.json"));
            const config = await loadConfig(rootDir);
            const agentModel = config.model?.model ?? "claude-sonnet-4-20250514";
            const entry = await historyStore.findEntry(failure_id);
            if (!entry) {
                return { content: [{ type: "text", text: `No failure found matching "${failure_id}"` }], isError: true };
            }
            const agent = new ExplainAgent(agentModel, rootDir);
            const report = await agent.explain({
                spec: entry.spec,
                scenario: entry.scenario,
                status: entry.status,
                timestamp: entry.timestamp,
            });
            return { content: [{ type: "text", text: report }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    });
    // --- generate_spec ---
    server.tool("generate_spec", "Auto-generate an AgentQA spec from the current git diff or a specific file.", {
        target: z.string().optional().describe("File path or git ref to generate spec from"),
        type: z.string().optional().describe("Force environment type: web, api, or logic"),
    }, async ({ target, type }) => {
        try {
            const { generateCommand } = await import("../commands/generate.js");
            const output = [];
            const origLog = console.log;
            console.log = (...args) => output.push(args.map(String).join(" "));
            try {
                await generateCommand(target, rootDir, {
                    type: type,
                    dryRun: true,
                });
            }
            catch {
                // generateCommand may call process.exit
            }
            console.log = origLog;
            return { content: [{ type: "text", text: output.join("\n") }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
    });
}
//# sourceMappingURL=tools.js.map