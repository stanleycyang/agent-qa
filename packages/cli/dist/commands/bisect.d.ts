export interface BisectOptions {
    good: string;
    bad?: string;
    maxSteps?: number;
}
export declare function bisectCommand(scenarioName: string, rootDir: string | undefined, options: BisectOptions): Promise<void>;
//# sourceMappingURL=bisect.d.ts.map