export interface HealOptions {
    threshold?: number;
    runs?: number;
    autoApply?: boolean;
}
/**
 * Find flaky scenarios, re-run them to observe the pattern,
 * then use FixAgent to diagnose and propose a fix.
 */
export declare function healCommand(rootDir?: string, options?: HealOptions): Promise<void>;
//# sourceMappingURL=heal.d.ts.map