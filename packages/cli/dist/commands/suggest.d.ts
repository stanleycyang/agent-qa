export interface SuggestOptions {
    dir?: string;
    since?: string;
    dryRun?: boolean;
    json?: boolean;
}
/**
 * Detect uncovered code changes and auto-generate spec suggestions.
 * Combines gap detection with spec generation in one step.
 */
export declare function suggestCommand(rootDir?: string, options?: SuggestOptions): Promise<void>;
//# sourceMappingURL=suggest.d.ts.map