export interface ImpactOptions {
    dir?: string;
    since?: string;
    top?: number;
    dryRun?: boolean;
    verbose?: boolean;
    json?: boolean;
    autoFix?: boolean;
}
export declare function impactCommand(rootDir?: string, options?: ImpactOptions): Promise<void>;
//# sourceMappingURL=impact.d.ts.map