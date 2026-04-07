import { AgentQAConfig } from "@agentqa/core";
/**
 * Build a context payload for the spec generator from a Linear or Jira issue URL.
 * Detects the platform from the URL host.
 */
export declare function buildIssueContext(url: string, config: AgentQAConfig): Promise<string>;
//# sourceMappingURL=generate-from-issue.d.ts.map