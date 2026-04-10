export interface RecordOptions {
    url?: string;
    dryRun?: boolean;
    out?: string;
}
/**
 * Interactive spec authoring: open a browser, user clicks through a flow,
 * agent watches and writes a spec from the captured actions.
 */
export declare function recordCommand(rootDir?: string, options?: RecordOptions): Promise<void>;
//# sourceMappingURL=record.d.ts.map