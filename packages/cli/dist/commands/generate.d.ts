export interface GenerateOptions {
    ref?: string;
    type?: "web" | "api" | "logic";
    out?: string;
    dryRun?: boolean;
    force?: boolean;
    fromFigma?: string;
    fromSentry?: string;
    fromIssue?: string;
}
export declare function generateCommand(target: string | undefined, rootDir?: string, options?: GenerateOptions): Promise<void>;
//# sourceMappingURL=generate.d.ts.map