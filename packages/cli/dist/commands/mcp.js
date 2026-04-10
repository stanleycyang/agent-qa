import chalk from "chalk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "../mcp/tools.js";
/**
 * Start AgentQA as an MCP server.
 * Other agents (Claude Code, Cursor, etc.) can call AgentQA tools
 * via the Model Context Protocol.
 */
export async function mcpCommand(rootDir = process.cwd(), _options = {}) {
    const server = new McpServer({
        name: "agentqa",
        version: "0.1.0",
    });
    registerTools(server, rootDir);
    // Start with stdio transport (reads from stdin, writes to stdout)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Log to stderr so stdout stays clean for JSON-RPC
    process.stderr.write(chalk.cyan("AgentQA MCP server started (stdio transport)\n"));
    // Keep process alive
    await new Promise((resolve) => {
        process.on("SIGINT", () => {
            process.stderr.write(chalk.gray("\nMCP server stopped.\n"));
            resolve();
        });
    });
}
//# sourceMappingURL=mcp.js.map