export interface GenerateOptions {
    ref?: string;
    type?: "web" | "api" | "logic";
    out?: string;
    dryRun?: boolean;
    force?: boolean;
    fromFigma?: string;
    /** True (no specific issue) or a Sentry issue ID. */
    fromSentry?: string | boolean;
    fromIssue?: string;
}
export declare function generateCommand(target: string | undefined, rootDir?: string, options?: GenerateOptions): Promise<void>;
//# sourceMappingURL=generate.d.ts.map