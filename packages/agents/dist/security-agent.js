import { LogicAgent } from "./logic-agent.js";
/**
 * Security audit agent. Extends LogicAgent with OWASP-aware system prompts
 * and additional pattern-matching tools. Useful for catching common
 * vulnerabilities in code review (no runtime testing).
 */
export class SecurityAgent extends LogicAgent {
    getTools() {
        return [
            ...super.getTools(),
            {
                name: "scan_secrets",
                description: "Scan a file for hardcoded secrets (API keys, tokens, passwords, private keys). Uses regex patterns to detect common secret formats.",
                input_schema: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: "File path to scan" },
                    },
                    required: ["path"],
                },
            },
        ];
    }
    async handleToolCall(name, input) {
        if (name === "scan_secrets") {
            return this.scanForSecrets(input.path);
        }
        return super.handleToolCall(name, input);
    }
    async scanForSecrets(filePath) {
        const fs = await import("fs/promises");
        const findings = [];
        const SECRET_PATTERNS = [
            { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/g, severity: "critical" },
            { name: "AWS Secret Key", regex: /aws_secret_access_key.{0,30}['"][0-9a-zA-Z\/+]{40}['"]/gi, severity: "critical" },
            { name: "GitHub Token", regex: /gh[pousr]_[a-zA-Z0-9]{36,}/g, severity: "critical" },
            { name: "Generic API Key", regex: /api[_-]?key.{0,20}['"][a-zA-Z0-9]{20,}['"]/gi, severity: "high" },
            { name: "Generic Secret", regex: /secret.{0,20}['"][a-zA-Z0-9]{16,}['"]/gi, severity: "high" },
            { name: "Private Key", regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, severity: "critical" },
            { name: "Slack Token", regex: /xox[pbar]-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{20,}/g, severity: "critical" },
            { name: "Stripe Key", regex: /sk_live_[0-9a-zA-Z]{24,}/g, severity: "critical" },
            { name: "JWT Token", regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, severity: "high" },
        ];
        try {
            const content = await fs.readFile(filePath, "utf-8");
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                for (const pattern of SECRET_PATTERNS) {
                    if (pattern.regex.test(line)) {
                        findings.push({
                            pattern: pattern.name,
                            line: `${filePath}:${i + 1}: ${line.trim().substring(0, 100)}`,
                            severity: pattern.severity,
                        });
                        pattern.regex.lastIndex = 0; // Reset for global regex
                    }
                }
            }
        }
        catch (err) {
            return { findings: [{ pattern: "error", line: err.message, severity: "info" }] };
        }
        return { findings };
    }
    buildSystemPrompt(_scenario) {
        return `You are a security audit agent reviewing code for vulnerabilities and unsafe patterns.

## Your approach
1. Use list_changed_files or git_diff to see what changed
2. Read changed files to understand the implementation
3. For each file, use scan_secrets to detect hardcoded credentials
4. Use grep_directory to find similar patterns across the codebase
5. Verify each expectation against your findings

## OWASP Top 10 to check
1. **Injection** (SQL, NoSQL, command, LDAP) — look for string concatenation with user input
2. **Broken authentication** — missing session handling, weak password policies, JWT without verification
3. **Sensitive data exposure** — hardcoded secrets, unencrypted storage, logging of PII
4. **XML external entities (XXE)** — XML parsers configured to resolve external entities
5. **Broken access control** — missing authorization checks, IDOR, privilege escalation
6. **Security misconfiguration** — default credentials, debug mode in prod, verbose error messages
7. **XSS** — unescaped user input rendered to HTML, dangerouslySetInnerHTML, eval
8. **Insecure deserialization** — pickle/marshal/unserialize on user input
9. **Vulnerable dependencies** — outdated packages with known CVEs
10. **Insufficient logging** — security events not logged, sensitive data in logs

## Severity guidance
- **Critical**: hardcoded production secrets, SQL injection, RCE, auth bypass
- **High**: XSS, weak crypto, missing HTTPS, exposed admin endpoints
- **Medium**: missing rate limiting, weak password requirements, unsafe defaults
- **Low**: verbose error messages, missing security headers

## Output format
Return your result as a JSON code block:
\`\`\`json
{
  "status": "pass" | "fail" | "error",
  "expectations": [
    { "text": "...", "status": "pass" | "fail", "confidence": 0.9, "evidence": "found hardcoded API key in src/config.ts:42", "reasoning": "..." }
  ],
  "summary": "..."
}
\`\`\``;
    }
}
//# sourceMappingURL=security-agent.js.map