export interface HistoryEntry {
    spec: string;
    scenario: string;
    status: "pass" | "fail" | "error";
    duration_ms: number;
    timestamp: number;
    commit_sha?: string;
    viewport?: string;
    browser?: string;
}
/**
 * Append-only history of scenario runs. Used by flaky detection,
 * performance regression detection, and bisect.
 */
export declare class HistoryStore {
    private historyPath;
    constructor(historyPath: string);
    append(entry: HistoryEntry): Promise<void>;
    load(): Promise<HistoryEntry[]>;
    getRunsFor(spec: string, scenario: string, limit?: number): Promise<HistoryEntry[]>;
    /**
     * Compute flakiness for a scenario.
     * Returns 0-1 fail rate over the last N runs.
     */
    getFlakiness(spec: string, scenario: string, window?: number): Promise<{
        rate: number;
        runs: number;
    }>;
    /**
     * Get median duration for a scenario over the last N runs.
     * Returns null if insufficient history (< 5 runs).
     */
    getMedianDuration(spec: string, scenario: string, window?: number): Promise<number | null>;
}
//# sourceMappingURL=history.d.ts.map