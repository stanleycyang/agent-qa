import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { HistoryStore, HistoryEntry } from "../history.js";

let tmpDir: string;
let historyPath: string;

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    spec: "Login",
    scenario: "happy path",
    status: "pass",
    duration_ms: 1000,
    timestamp: Date.now(),
    ...overrides,
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "agentqa-history-"));
  historyPath = path.join(tmpDir, "history.json");
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("HistoryStore", () => {
  describe("load", () => {
    it("returns empty array for non-existent file", async () => {
      const store = new HistoryStore(historyPath);
      const entries = await store.load();
      expect(entries).toEqual([]);
    });

    it("returns entries from existing file", async () => {
      const data = [makeEntry()];
      await fs.writeFile(historyPath, JSON.stringify(data));
      const store = new HistoryStore(historyPath);
      const entries = await store.load();
      expect(entries).toHaveLength(1);
    });

    it("returns a copy (not the internal array)", async () => {
      const store = new HistoryStore(historyPath);
      const a = await store.load();
      const b = await store.load();
      expect(a).not.toBe(b);
    });
  });

  describe("appendBuffered and flush", () => {
    it("persists entries after flush", async () => {
      const store = new HistoryStore(historyPath);
      await store.appendBuffered(makeEntry());
      await store.flush();

      const content = JSON.parse(await fs.readFile(historyPath, "utf-8"));
      expect(content).toHaveLength(1);
    });

    it("does not write to disk without flush", async () => {
      const store = new HistoryStore(historyPath);
      await store.appendBuffered(makeEntry());

      let exists = true;
      try {
        await fs.access(historyPath);
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);
    });
  });

  describe("append (convenience)", () => {
    it("writes immediately to disk", async () => {
      const store = new HistoryStore(historyPath);
      await store.append(makeEntry());

      const content = JSON.parse(await fs.readFile(historyPath, "utf-8"));
      expect(content).toHaveLength(1);
    });
  });

  describe("MAX_ENTRIES trimming", () => {
    it("trims to 1000 entries when exceeded", async () => {
      const store = new HistoryStore(historyPath);
      for (let i = 0; i < 1002; i++) {
        await store.appendBuffered(makeEntry({ timestamp: i }));
      }
      await store.flush();

      const content = JSON.parse(await fs.readFile(historyPath, "utf-8"));
      expect(content).toHaveLength(1000);
      // Oldest entries (0, 1) should be trimmed
      expect(content[0].timestamp).toBe(2);
    });
  });

  describe("getFlakiness", () => {
    it("returns rate 0 and runs 0 for no history", async () => {
      const store = new HistoryStore(historyPath);
      const result = await store.getFlakiness("Login", "happy path");
      expect(result).toEqual({ rate: 0, runs: 0 });
    });

    it("returns rate 0 when all runs pass", async () => {
      const store = new HistoryStore(historyPath);
      for (let i = 0; i < 5; i++) {
        await store.appendBuffered(makeEntry({ status: "pass" }));
      }
      const result = await store.getFlakiness("Login", "happy path");
      expect(result.rate).toBe(0);
      expect(result.runs).toBe(5);
    });

    it("returns correct rate when some runs fail", async () => {
      const store = new HistoryStore(historyPath);
      for (let i = 0; i < 8; i++) {
        await store.appendBuffered(makeEntry({ status: i < 4 ? "pass" : "fail" }));
      }
      const result = await store.getFlakiness("Login", "happy path");
      expect(result.rate).toBe(0.5);
      expect(result.runs).toBe(8);
    });

    it("respects window parameter", async () => {
      const store = new HistoryStore(historyPath);
      // Add 5 pass then 5 fail
      for (let i = 0; i < 5; i++) {
        await store.appendBuffered(makeEntry({ status: "pass", timestamp: i }));
      }
      for (let i = 0; i < 5; i++) {
        await store.appendBuffered(makeEntry({ status: "fail", timestamp: i + 5 }));
      }
      // Window of 5 should only see the last 5 (all fails)
      const result = await store.getFlakiness("Login", "happy path", 5);
      expect(result.rate).toBe(1.0);
      expect(result.runs).toBe(5);
    });
  });

  describe("getMedianDuration", () => {
    it("returns null if fewer than 5 runs", async () => {
      const store = new HistoryStore(historyPath);
      for (let i = 0; i < 4; i++) {
        await store.appendBuffered(makeEntry({ duration_ms: 100 }));
      }
      expect(await store.getMedianDuration("Login", "happy path")).toBeNull();
    });

    it("returns null if fewer than 3 passing runs", async () => {
      const store = new HistoryStore(historyPath);
      for (let i = 0; i < 5; i++) {
        await store.appendBuffered(
          makeEntry({ status: i < 2 ? "pass" : "fail", duration_ms: 100 }),
        );
      }
      expect(await store.getMedianDuration("Login", "happy path")).toBeNull();
    });

    it("computes correct median for odd count of passing runs", async () => {
      const store = new HistoryStore(historyPath);
      const durations = [100, 200, 300, 400, 500];
      for (const d of durations) {
        await store.appendBuffered(makeEntry({ duration_ms: d }));
      }
      // 5 passing runs, sorted: [100,200,300,400,500], median index = floor(5/2) = 2 -> 300
      expect(await store.getMedianDuration("Login", "happy path")).toBe(300);
    });

    it("computes correct median for even count of passing runs", async () => {
      const store = new HistoryStore(historyPath);
      const durations = [100, 200, 300, 400, 500, 600];
      for (const d of durations) {
        await store.appendBuffered(makeEntry({ duration_ms: d }));
      }
      // 6 passing runs, sorted: [100,200,300,400,500,600], median index = floor(6/2) = 3 -> 400
      expect(await store.getMedianDuration("Login", "happy path")).toBe(400);
    });
  });

  describe("findEntry", () => {
    it("'last' returns most recent non-pass entry", async () => {
      const store = new HistoryStore(historyPath);
      await store.appendBuffered(makeEntry({ status: "fail", timestamp: 1 }));
      await store.appendBuffered(makeEntry({ status: "pass", timestamp: 2 }));
      await store.appendBuffered(makeEntry({ status: "error", timestamp: 3 }));
      await store.appendBuffered(makeEntry({ status: "pass", timestamp: 4 }));

      const result = await store.findEntry("last");
      expect(result).not.toBeNull();
      expect(result!.timestamp).toBe(3);
      expect(result!.status).toBe("error");
    });

    it("'last' returns null if all entries pass", async () => {
      const store = new HistoryStore(historyPath);
      await store.appendBuffered(makeEntry({ status: "pass" }));
      expect(await store.findEntry("last")).toBeNull();
    });

    it("finds by exact 'spec::scenario::timestamp' format", async () => {
      const store = new HistoryStore(historyPath);
      await store.appendBuffered(makeEntry({ spec: "A", scenario: "b", timestamp: 12345 }));
      const result = await store.findEntry("A::b::12345");
      expect(result).not.toBeNull();
      expect(result!.spec).toBe("A");
    });

    it("fuzzy matches by scenario name substring", async () => {
      const store = new HistoryStore(historyPath);
      await store.appendBuffered(
        makeEntry({ scenario: "Happy Path Login", status: "fail", timestamp: 1 }),
      );
      const result = await store.findEntry("happy path");
      expect(result).not.toBeNull();
      expect(result!.scenario).toBe("Happy Path Login");
    });

    it("fuzzy matches by spec name substring", async () => {
      const store = new HistoryStore(historyPath);
      await store.appendBuffered(
        makeEntry({ spec: "Checkout Flow", status: "fail", timestamp: 1 }),
      );
      const result = await store.findEntry("checkout");
      expect(result).not.toBeNull();
      expect(result!.spec).toBe("Checkout Flow");
    });

    it("returns null when no match found", async () => {
      const store = new HistoryStore(historyPath);
      await store.appendBuffered(makeEntry({ status: "pass" }));
      expect(await store.findEntry("nonexistent")).toBeNull();
    });
  });

  describe("listRecentFailures", () => {
    it("returns up to N most recent non-pass entries", async () => {
      const store = new HistoryStore(historyPath);
      for (let i = 0; i < 20; i++) {
        await store.appendBuffered(makeEntry({ status: "fail", timestamp: i }));
      }
      const failures = await store.listRecentFailures(5);
      expect(failures).toHaveLength(5);
      // Most recent first
      expect(failures[0].timestamp).toBe(19);
    });

    it("skips pass entries", async () => {
      const store = new HistoryStore(historyPath);
      await store.appendBuffered(makeEntry({ status: "pass", timestamp: 1 }));
      await store.appendBuffered(makeEntry({ status: "fail", timestamp: 2 }));
      await store.appendBuffered(makeEntry({ status: "pass", timestamp: 3 }));
      const failures = await store.listRecentFailures(10);
      expect(failures).toHaveLength(1);
      expect(failures[0].timestamp).toBe(2);
    });
  });

  describe("getLastPassingForSpec", () => {
    it("returns true when all scenarios pass at SHA", async () => {
      const store = new HistoryStore(historyPath);
      await store.appendBuffered(makeEntry({ spec: "Login", scenario: "a", status: "pass", commit_sha: "abc" }));
      await store.appendBuffered(makeEntry({ spec: "Login", scenario: "b", status: "pass", commit_sha: "abc" }));
      expect(await store.getLastPassingForSpec("Login", "abc")).toBe(true);
    });

    it("returns false when any scenario fails at SHA", async () => {
      const store = new HistoryStore(historyPath);
      await store.appendBuffered(makeEntry({ spec: "Login", scenario: "a", status: "pass", commit_sha: "abc" }));
      await store.appendBuffered(makeEntry({ spec: "Login", scenario: "b", status: "fail", commit_sha: "abc" }));
      expect(await store.getLastPassingForSpec("Login", "abc")).toBe(false);
    });

    it("returns false when no entries exist for SHA", async () => {
      const store = new HistoryStore(historyPath);
      expect(await store.getLastPassingForSpec("Login", "xyz")).toBe(false);
    });
  });

  describe("getAllStats", () => {
    it("groups entries by spec+scenario and computes stats", async () => {
      const store = new HistoryStore(historyPath);
      await store.appendBuffered(makeEntry({ spec: "Login", scenario: "a", status: "pass", duration_ms: 100 }));
      await store.appendBuffered(makeEntry({ spec: "Login", scenario: "a", status: "fail", duration_ms: 200 }));
      await store.appendBuffered(makeEntry({ spec: "Login", scenario: "b", status: "pass", duration_ms: 300 }));

      const stats = await store.getAllStats();
      expect(stats).toHaveLength(2);

      const statA = stats.find(s => s.scenario === "a")!;
      expect(statA.runs).toBe(2);
      expect(statA.failures).toBe(1);
      expect(statA.rate).toBe(0.5);
      expect(statA.durations).toEqual([100, 200]);

      const statB = stats.find(s => s.scenario === "b")!;
      expect(statB.runs).toBe(1);
      expect(statB.failures).toBe(0);
      expect(statB.rate).toBe(0);
    });
  });

  describe("flush idempotency", () => {
    it("flush is no-op when not dirty", async () => {
      const store = new HistoryStore(historyPath);
      // Load (creates empty cache) but don't modify
      await store.load();
      await store.flush();
      // File should not exist since nothing was appended
      let exists = true;
      try {
        await fs.access(historyPath);
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);
    });
  });
});
