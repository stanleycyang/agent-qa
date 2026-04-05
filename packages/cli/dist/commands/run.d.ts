export interface RunOptions {
    dir?: string;
    verbose?: boolean;
    json?: boolean;
    dryRun?: boolean;
    watch?: boolean;
}
export declare function runCommand(specName?: string, rootDir?: string, options?: RunOptions): Promise<void>;
//# sourceMappingURL=run.d.ts.map