import { AgentQAConfig } from "@agentqa/core";
/**
 * Build a context payload for the spec generator from a Figma URL.
 * Requires FIGMA_TOKEN env var (or config.integrations.figma_token).
 */
export declare function buildFigmaContext(url: string, config: AgentQAConfig): Promise<string>;
//# sourceMappingURL=generate-from-figma.d.ts.map