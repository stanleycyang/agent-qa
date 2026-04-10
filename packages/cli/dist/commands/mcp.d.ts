export interface McpOptions {
    transport?: "stdio";
}
/**
 * Start AgentQA as an MCP server.
 * Other agents (Claude Code, Cursor, etc.) can call AgentQA tools
 * via the Model Context Protocol.
 */
export declare function mcpCommand(rootDir?: string, _options?: McpOptions): Promise<void>;
//# sourceMappingURL=mcp.d.ts.map