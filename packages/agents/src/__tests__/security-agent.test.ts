import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { SecurityAgent } from "../security-agent.js";

let tmpDir: string;
let agent: SecurityAgent;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "agentqa-security-"));
  agent = new SecurityAgent("claude-sonnet-4-20250514");
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function writeAndScan(content: string) {
  const filePath = path.join(tmpDir, "test-file.ts");
  await fs.writeFile(filePath, content);
  return agent.handleToolCall("scan_secrets", { path: filePath }) as Promise<{
    findings: Array<{ pattern: string; line: string; severity: string }>;
  }>;
}

// Build test tokens dynamically to avoid triggering GitHub push protection.
// The regex patterns in SecurityAgent match these constructed values.
const fakeAwsKey = "AKIA" + "IOSFODNN7EXAMPLE";
const fakeGhpToken = "ghp_" + "A".repeat(36);
const fakeGhoToken = "gho_" + "A".repeat(36);
const fakeSlackToken = ["xoxb", "1234567890", "1234567890", "A".repeat(24)].join("-");
const fakeStripeKey = "sk_live_" + "a".repeat(26);

describe("SecurityAgent scanForSecrets", () => {
  it("detects AWS access keys", async () => {
    const result = await writeAndScan(`const key = "${fakeAwsKey}";`);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].pattern).toBe("AWS Access Key");
    expect(result.findings[0].severity).toBe("critical");
  });

  it("detects GitHub tokens (ghp_)", async () => {
    const result = await writeAndScan(`const token = "${fakeGhpToken}";`);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].pattern).toBe("GitHub Token");
    expect(result.findings[0].severity).toBe("critical");
  });

  it("detects GitHub tokens (gho_ variant)", async () => {
    const result = await writeAndScan(`const token = "${fakeGhoToken}";`);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].pattern).toBe("GitHub Token");
  });

  it("detects generic API keys", async () => {
    const result = await writeAndScan(
      "const api_key = 'abcdefghijklmnopqrstuvwxyz';",
    );
    expect(result.findings.some(f => f.pattern === "Generic API Key")).toBe(true);
  });

  it("detects private keys", async () => {
    const result = await writeAndScan("-----BEGIN RSA PRIVATE KEY-----\nMIIEow...");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].pattern).toBe("Private Key");
    expect(result.findings[0].severity).toBe("critical");
  });

  it("detects OPENSSH private keys", async () => {
    const result = await writeAndScan("-----BEGIN OPENSSH PRIVATE KEY-----");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].pattern).toBe("Private Key");
  });

  it("detects Slack tokens", async () => {
    const result = await writeAndScan(`const slack = "${fakeSlackToken}";`);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].pattern).toBe("Slack Token");
    expect(result.findings[0].severity).toBe("critical");
  });

  it("detects Stripe keys", async () => {
    const result = await writeAndScan(`const stripe = "${fakeStripeKey}";`);
    expect(result.findings.some(f => f.pattern === "Stripe Key")).toBe(true);
    expect(result.findings.find(f => f.pattern === "Stripe Key")?.severity).toBe("critical");
  });

  it("detects JWT tokens", async () => {
    // Build a JWT-like token dynamically
    const header = "eyJ" + "a".repeat(20);
    const payload = "eyJ" + "b".repeat(20);
    const sig = "c".repeat(20);
    const jwt = `${header}.${payload}.${sig}`;
    const result = await writeAndScan(`const token = "${jwt}";`);
    expect(result.findings.some(f => f.pattern === "JWT Token")).toBe(true);
  });

  it("does NOT flag normal code (no false positives)", async () => {
    const result = await writeAndScan(`
      const apiUrl = "https://api.example.com";
      const userName = "admin";
      const port = 3000;
      function getApiKey() { return process.env.API_KEY; }
    `);
    expect(result.findings).toHaveLength(0);
  });

  it("handles file read errors gracefully", async () => {
    const result = (await agent.handleToolCall("scan_secrets", {
      path: "/nonexistent/path/file.ts",
    })) as { findings: Array<{ pattern: string; severity: string }> };
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].pattern).toBe("error");
    expect(result.findings[0].severity).toBe("info");
  });

  it("reports correct line numbers", async () => {
    const content = `line one\nline two\nconst key = "${fakeAwsKey}";\nline four`;
    const result = await writeAndScan(content);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].line).toContain(":3:");
  });

  it("detects multiple secrets in the same file", async () => {
    const content = `
const awsKey = "${fakeAwsKey}";
const stripe = "${fakeStripeKey}";
-----BEGIN PRIVATE KEY-----
    `;
    const result = await writeAndScan(content);
    expect(result.findings.length).toBeGreaterThanOrEqual(3);
  });

  it("detects secrets with different quote styles", async () => {
    const result = await writeAndScan(
      'const secret = "mysupersecretvalue12345678";',
    );
    expect(result.findings.some(f => f.pattern === "Generic Secret")).toBe(true);
  });
});
