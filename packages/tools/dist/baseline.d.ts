/**
 * Manages baseline screenshots for visual regression testing.
 * Baselines are stored in .agentqa/baselines/{spec}/{scenario}/{name}.png
 * and should be committed to git alongside the spec files.
 */
export declare class BaselineStore {
    private baselineDir;
    constructor(baselineDir: string);
    private getPath;
    exists(specName: string, scenarioName: string, baselineName: string): Promise<boolean>;
    load(specName: string, scenarioName: string, baselineName: string): Promise<string | null>;
    save(specName: string, scenarioName: string, baselineName: string, base64: string): Promise<string>;
}
//# sourceMappingURL=baseline.d.ts.map