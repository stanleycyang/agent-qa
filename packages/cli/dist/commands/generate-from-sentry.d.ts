import { AgentQAConfig } from "@agentqa/core";
/**
 * Build a context payload for the spec generator from Sentry issues.
 * Requires SENTRY_TOKEN, SENTRY_ORG, SENTRY_PROJECT env vars.
 *
 * If issueIdOrEmpty is empty/undefined, fetches the top 5 unresolved issues.
 * If a specific issue ID is given, fetches that issue's events and breadcrumbs.
 */
export declare function buildSentryContext(issueIdOrEmpty: string | boolean | undefined, config: AgentQAConfig): Promise<string>;
//# sourceMappingURL=generate-from-sentry.d.ts.map