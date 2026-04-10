import * as fs from "fs/promises";
import * as path from "path";
const MAX_ENTRIES = 1000;
const FLAKY_WINDOW = 10;
/**
 * Append-only history of scenario runs. Used by flaky detection,
 * performance regression detection, and bisect.
 *
 * Lazy-loads on first read; subsequent operations work on the in-memory
 * cache. Callers should call `flush()` once at the end of a run to persist
 * appended entries — `appendBuffered` does NOT touch disk per call.
 */
export class HistoryStore {
    historyPath;
    entries = null;
    dirty = false;
    constructor(historyPath) {
        this.historyPath = historyPath;
    }
    async ensureLoaded() {
        if (this.entries !== null)
            return this.entries;
        try {
            const content = await fs.readFile(this.historyPath, "utf-8");
            const parsed = JSON.parse(content);
            this.entries = Array.isArray(parsed) ? parsed : [];
        }
        catch {
            this.entries = [];
        }
        return this.entries;
    }
    /** Public read of all entries (for `flaky` command, reports). */
    async load() {
        return [...(await this.ensureLoaded())];
    }
    /**
     * Buffer a new entry in memory. Caller must call `flush()` to persist.
     * This is the hot-path API used by the run command.
     */
    async appendBuffered(entry) {
        const entries = await this.ensureLoaded();
        entries.push(entry);
        if (entries.length > MAX_ENTRIES) {
            entries.splice(0, entries.length - MAX_ENTRIES);
        }
        this.dirty = true;
    }
    /** Persist the in-memory entries to disk if dirty. */
    async flush() {
        if (!this.dirty || this.entries === null)
            return;
        await fs.mkdir(path.dirname(this.historyPath), { recursive: true });
        await fs.writeFile(this.historyPath, JSON.stringify(this.entries, null, 2));
        this.dirty = false;
    }
    /** Convenience: append + flush. Use only outside hot paths. */
    async append(entry) {
        await this.appendBuffered(entry);
        await this.flush();
    }
    async filterRuns(spec, scenario, limit) {
        const all = await this.ensureLoaded();
        const matching = [];
        for (const e of all) {
            if (e.spec === spec && e.scenario === scenario)
                matching.push(e);
        }
        return matching.length > limit ? matching.slice(-limit) : matching;
    }
    /**
     * Compute flakiness for a scenario over the most recent `window` runs.
     */
    async getFlakiness(spec, scenario, window = FLAKY_WINDOW) {
        const runs = await this.filterRuns(spec, scenario, window);
        if (runs.length === 0)
            return { rate: 0, runs: 0 };
        let failures = 0;
        for (const r of runs)
            if (r.status !== "pass")
                failures++;
        return { rate: failures / runs.length, runs: runs.length };
    }
    /**
     * Median duration of passing runs over the most recent `window` entries.
     * Returns null if there's insufficient data (< 5 runs or < 3 passing).
     */
    async getMedianDuration(spec, scenario, window = 20) {
        const runs = await this.filterRuns(spec, scenario, window);
        if (runs.length < 5)
            return null;
        const durations = [];
        for (const r of runs)
            if (r.status === "pass")
                durations.push(r.duration_ms);
        if (durations.length < 3)
            return null;
        durations.sort((a, b) => a - b);
        return durations[Math.floor(durations.length / 2)];
    }
    /**
     * Find a specific failure entry by id.
     * Supported id formats:
     * - "last" — the most recent non-pass entry
     * - "spec::scenario::timestamp" — exact match
     */
    async findEntry(failureId) {
        const all = await this.ensureLoaded();
        if (failureId === "last") {
            for (let i = all.length - 1; i >= 0; i--) {
                if (all[i].status !== "pass")
                    return all[i];
            }
            return null;
        }
        // Parse "spec::scenario::timestamp"
        const parts = failureId.split("::");
        if (parts.length >= 3) {
            const [spec, scenario, ts] = parts;
            const timestamp = parseInt(ts, 10);
            for (let i = all.length - 1; i >= 0; i--) {
                const e = all[i];
                if (e.spec === spec && e.scenario === scenario && e.timestamp === timestamp) {
                    return e;
                }
            }
        }
        // Fuzzy: try matching just the scenario name
        for (let i = all.length - 1; i >= 0; i--) {
            const e = all[i];
            if ((e.scenario.toLowerCase().includes(failureId.toLowerCase()) || e.spec.toLowerCase().includes(failureId.toLowerCase())) && e.status !== "pass") {
                return e;
            }
        }
        return null;
    }
    /** Return the N most recent non-pass entries. */
    async listRecentFailures(n = 10) {
        const all = await this.ensureLoaded();
        const failures = [];
        for (let i = all.length - 1; i >= 0 && failures.length < n; i--) {
            if (all[i].status !== "pass")
                failures.push(all[i]);
        }
        return failures;
    }
    /**
     * Group all entries by (spec, scenario) and compute per-scenario stats.
     * Single-pass over the history. Used by the `flaky` command.
     */
    async getAllStats() {
        const all = await this.ensureLoaded();
        const groups = new Map();
        for (const e of all) {
            const key = `${e.spec}::${e.scenario}`;
            let g = groups.get(key);
            if (!g) {
                g = { spec: e.spec, scenario: e.scenario, runs: 0, failures: 0, rate: 0, durations: [] };
                groups.set(key, g);
            }
            g.runs++;
            if (e.status !== "pass")
                g.failures++;
            g.durations.push(e.duration_ms);
        }
        for (const g of groups.values()) {
            g.rate = g.runs > 0 ? g.failures / g.runs : 0;
        }
        return [...groups.values()];
    }
}
//# sourceMappingURL=history.js.map