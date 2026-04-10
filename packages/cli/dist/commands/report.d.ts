export interface ReportOptions {
    input: string;
    out?: string;
}
/**
 * Read a JSON results file (from `agentqa run --json`) and produce a
 * markdown report. Intended for CI — the GitHub workflow pipes `agentqa
 * report --input results.json` instead of building markdown inline.
 */
export declare function reportCommand(options: ReportOptions): Promise<void>;
//# sourceMappingURL=report.d.ts.map