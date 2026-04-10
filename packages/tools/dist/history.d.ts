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
export interface FlakinessResult {
    rate: number;
    runs: number;
}
export interface ScenarioStats {
    spec: string;
    scenario: string;
    runs: number;
    failures: number;
    rate: number;
    durations: number[];
}
/**
 * Append-only history of scenario runs. Used by flaky detection,
 * performance regression detection, and bisect.
 *
 * Lazy-loads on first read; subsequent operations work on the in-memory
 * cache. Callers should call `flush()` once at the end of a run to persist
 * appended entries — `appendBuffered` does NOT touch disk per call.
 */
export declare class HistoryStore {
    private historyPath;
    private entries;
    private dirty;
    constructor(historyPath: string);
    private ensureLoaded;
    /** Public read of all entries (for `flaky` command, reports). */
    load(): Promise<HistoryEntry[]>;
    /**
     * Buffer a new entry in memory. Caller must call `flush()` to persist.
     * This is the hot-path API used by the run command.
     */
    appendBuffered(entry: HistoryEntry): Promise<void>;
    /** Persist the in-memory entries to disk if dirty. */
    flush(): Promise<void>;
    /** Convenience: append + flush. Use only outside hot paths. */
    append(entry: HistoryEntry): Promise<void>;
    private filterRuns;
    /**
     * Compute flakiness for a scenario over the most recent `window` runs.
     */
    getFlakiness(spec: string, scenario: string, window?: number): Promise<FlakinessResult>;
    /**
     * Median duration of passing runs over the most recent `window` entries.
     * Returns null if there's insufficient data (< 5 runs or < 3 passing).
     */
    getMedianDuration(spec: string, scenario: string, window?: number): Promise<number | null>;
    /**
     * Find a specific failure entry by id.
     * Supported id formats:
     * - "last" — the most recent non-pass entry
     * - "spec::scenario::timestamp" — exact match
     */
    findEntry(failureId: string): Promise<HistoryEntry | null>;
    /** Return the N most recent non-pass entries. */
    listRecentFailures(n?: number): Promise<HistoryEntry[]>;
    /** Check if all scenarios of a spec passed at a given commit SHA. */
    getLastPassingForSpec(specName: string, sha: string): Promise<boolean>;
    /**
     * Group all entries by (spec, scenario) and compute per-scenario stats.
     * Single-pass over the history. Used by the `flaky` command.
     */
    getAllStats(): Promise<ScenarioStats[]>;
}
//# sourceMappingURL=history.d.ts.map