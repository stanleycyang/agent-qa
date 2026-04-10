export interface ReproduceOptions {
    dryRun?: boolean;
}
/**
 * Generate a regression spec from a Sentry issue ID or Linear/Jira URL,
 * then immediately run it to verify the bug reproduces.
 */
export declare function reproduceCommand(source: string, rootDir?: string, options?: ReproduceOptions): Promise<void>;
//# sourceMappingURL=reproduce.d.ts.map