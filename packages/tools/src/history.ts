import * as fs from "fs/promises";
import * as path from "path";

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
export class HistoryStore {
  constructor(private historyPath: string) {}

  async append(entry: HistoryEntry): Promise<void> {
    const entries = await this.load();
    entries.push(entry);
    // Keep last 1000 entries to prevent unbounded growth
    const trimmed = entries.slice(-1000);
    await fs.mkdir(path.dirname(this.historyPath), { recursive: true });
    await fs.writeFile(this.historyPath, JSON.stringify(trimmed, null, 2));
  }

  async load(): Promise<HistoryEntry[]> {
    try {
      const content = await fs.readFile(this.historyPath, "utf-8");
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async getRunsFor(spec: string, scenario: string, limit = 10): Promise<HistoryEntry[]> {
    const all = await this.load();
    return all
      .filter(e => e.spec === spec && e.scenario === scenario)
      .slice(-limit);
  }

  /**
   * Compute flakiness for a scenario.
   * Returns 0-1 fail rate over the last N runs.
   */
  async getFlakiness(spec: string, scenario: string, window = 10): Promise<{ rate: number; runs: number }> {
    const runs = await this.getRunsFor(spec, scenario, window);
    if (runs.length === 0) return { rate: 0, runs: 0 };
    const failures = runs.filter(r => r.status !== "pass").length;
    return { rate: failures / runs.length, runs: runs.length };
  }

  /**
   * Get median duration for a scenario over the last N runs.
   * Returns null if insufficient history (< 5 runs).
   */
  async getMedianDuration(spec: string, scenario: string, window = 20): Promise<number | null> {
    const runs = await this.getRunsFor(spec, scenario, window);
    if (runs.length < 5) return null;
    const passing = runs.filter(r => r.status === "pass");
    if (passing.length < 3) return null;
    const durations = passing.map(r => r.duration_ms).sort((a, b) => a - b);
    return durations[Math.floor(durations.length / 2)];
  }
}
