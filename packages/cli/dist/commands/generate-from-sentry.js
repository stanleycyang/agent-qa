import axios from "axios";
/**
 * Build a context payload for the spec generator from Sentry issues.
 * Requires SENTRY_TOKEN, SENTRY_ORG, SENTRY_PROJECT env vars.
 *
 * If issueIdOrEmpty is empty/undefined, fetches the top 5 unresolved issues.
 * If a specific issue ID is given, fetches that issue's events and breadcrumbs.
 */
export async function buildSentryContext(issueIdOrEmpty, config) {
    const token = process.env.SENTRY_TOKEN ?? config.integrations?.sentry_token;
    const org = process.env.SENTRY_ORG ?? config.integrations?.sentry_org;
    const project = process.env.SENTRY_PROJECT ?? config.integrations?.sentry_project;
    if (!token || !org || !project) {
        throw new Error("Sentry integration requires SENTRY_TOKEN, SENTRY_ORG, SENTRY_PROJECT.\n" +
            "Get a token at https://sentry.io/settings/account/api/auth-tokens/ with project:read scope.\n" +
            "Then export them or add to .agentqa/config.yaml under integrations:");
    }
    const headers = { Authorization: `Bearer ${token}` };
    const baseUrl = "https://sentry.io/api/0";
    // Resolve which issue(s) to fetch. When the user passes --from-sentry with no
    // value, Commander supplies `true`; with --from-sentry abc123 it supplies a string.
    const explicitId = typeof issueIdOrEmpty === "string" && issueIdOrEmpty.length > 0
        ? issueIdOrEmpty
        : null;
    const issueIds = [];
    if (!explicitId) {
        // Fetch top unresolved issues
        try {
            const resp = await axios.get(`${baseUrl}/projects/${org}/${project}/issues/`, {
                headers,
                params: { query: "is:unresolved", limit: 5, sort: "freq" },
            });
            for (const issue of resp.data) {
                issueIds.push(issue.id);
            }
        }
        catch (err) {
            throw new Error(`Sentry API error: ${err.message}`);
        }
    }
    else {
        issueIds.push(explicitId);
    }
    if (issueIds.length === 0) {
        throw new Error("No Sentry issues found");
    }
    // Fetch detailed event for each issue (latest occurrence)
    const issueContexts = [];
    for (const issueId of issueIds) {
        try {
            const issueResp = await axios.get(`${baseUrl}/issues/${issueId}/`, { headers });
            const eventResp = await axios.get(`${baseUrl}/issues/${issueId}/events/latest/`, { headers });
            const issue = issueResp.data;
            const event = eventResp.data;
            const breadcrumbs = (event.entries ?? [])
                .find((e) => e.type === "breadcrumbs")?.data?.values ?? [];
            const exception = (event.entries ?? [])
                .find((e) => e.type === "exception")?.data?.values?.[0];
            const breadcrumbText = breadcrumbs
                .slice(-15)
                .map((b) => `  - [${b.category ?? "?"}] ${b.message ?? JSON.stringify(b.data ?? {})}`)
                .join("\n");
            issueContexts.push(`### Issue ${issueId}: ${issue.title}
Culprit: ${issue.culprit ?? "unknown"}
Count: ${issue.count} events
Users affected: ${issue.userCount ?? 0}

Exception: ${exception?.type ?? "?"}: ${exception?.value ?? ""}

User actions before crash (breadcrumbs):
${breadcrumbText || "  (none captured)"}
`);
        }
        catch (err) {
            issueContexts.push(`### Issue ${issueId}: failed to fetch (${err.message})`);
        }
    }
    return `Generate AgentQA regression specs that reproduce the user actions that triggered these production errors. Each spec should reproduce the steps from the breadcrumbs and verify the error does NOT occur (the page should load normally, no error UI shown, no console errors).

${issueContexts.join("\n")}

For each issue, generate a web spec that:
1. Reproduces the user actions from the breadcrumbs
2. Expects no JavaScript errors (use get_console_errors)
3. Expects no error UI (use detect_visual_issues)
4. Tags the spec with a comment referencing the Sentry issue ID`;
}
//# sourceMappingURL=generate-from-sentry.js.map