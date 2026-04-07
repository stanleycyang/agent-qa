import axios from "axios";
/**
 * Build a context payload for the spec generator from a Linear or Jira issue URL.
 * Detects the platform from the URL host.
 */
export async function buildIssueContext(url, config) {
    if (url.includes("linear.app")) {
        return await buildLinearContext(url, config);
    }
    if (url.includes("atlassian.net") || url.includes("/browse/")) {
        return await buildJiraContext(url, config);
    }
    throw new Error(`Unrecognized issue URL: ${url}. Expected linear.app or *.atlassian.net.`);
}
async function buildLinearContext(url, config) {
    const token = process.env.LINEAR_TOKEN ?? config.integrations?.linear_token;
    if (!token) {
        throw new Error("LINEAR_TOKEN is not set. Get one at https://linear.app/settings/api " +
            "and export it: export LINEAR_TOKEN=lin_api_...");
    }
    // Extract issue identifier (e.g. ENG-123 from https://linear.app/team/issue/ENG-123/...)
    const match = url.match(/\/issue\/([A-Z]+-\d+)/);
    if (!match) {
        throw new Error(`Could not parse Linear issue ID from URL: ${url}`);
    }
    const issueId = match[1];
    // Linear uses GraphQL
    const query = `
    query Issue($id: String!) {
      issue(id: $id) {
        title
        description
        identifier
        url
        labels { nodes { name } }
        state { name }
      }
    }
  `;
    let issue;
    try {
        const resp = await axios.post("https://api.linear.app/graphql", { query, variables: { id: issueId } }, { headers: { Authorization: token, "Content-Type": "application/json" } });
        if (resp.data.errors)
            throw new Error(JSON.stringify(resp.data.errors));
        issue = resp.data.data?.issue;
    }
    catch (err) {
        throw new Error(`Linear API error: ${err.message}`);
    }
    if (!issue) {
        throw new Error(`Linear issue ${issueId} not found`);
    }
    return `Generate AgentQA test specs for the following Linear issue.

Issue: ${issue.identifier} — ${issue.title}
URL: ${issue.url}
State: ${issue.state?.name ?? "unknown"}
Labels: ${(issue.labels?.nodes ?? []).map((l) => l.name).join(", ")}

Description:
${issue.description ?? "(no description)"}

Read relevant files in the codebase to understand the implementation, then generate one or more YAML specs that verify the acceptance criteria from the description. Treat any bullet points, "Given/When/Then" patterns, or numbered lists as expectations.`;
}
async function buildJiraContext(url, config) {
    const token = process.env.JIRA_TOKEN ?? config.integrations?.jira_token;
    const host = process.env.JIRA_HOST ?? config.integrations?.jira_host;
    const email = process.env.JIRA_EMAIL ?? config.integrations?.jira_email;
    if (!token || !host || !email) {
        throw new Error("Jira integration requires JIRA_TOKEN, JIRA_HOST, JIRA_EMAIL.\n" +
            "Get a token at https://id.atlassian.com/manage-profile/security/api-tokens");
    }
    // Extract issue key (e.g. PROJ-123 from .../browse/PROJ-123)
    const match = url.match(/\/browse\/([A-Z]+-\d+)/);
    if (!match) {
        throw new Error(`Could not parse Jira issue key from URL: ${url}`);
    }
    const issueKey = match[1];
    const auth = Buffer.from(`${email}:${token}`).toString("base64");
    let issue;
    try {
        const resp = await axios.get(`https://${host}/rest/api/3/issue/${issueKey}`, {
            headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
        });
        issue = resp.data;
    }
    catch (err) {
        throw new Error(`Jira API error: ${err.message}`);
    }
    // Jira description is in Atlassian Document Format; flatten to text
    const description = flattenAdf(issue.fields?.description) || "(no description)";
    return `Generate AgentQA test specs for the following Jira issue.

Issue: ${issue.key} — ${issue.fields?.summary ?? "untitled"}
Status: ${issue.fields?.status?.name ?? "unknown"}
Type: ${issue.fields?.issuetype?.name ?? "unknown"}

Description:
${description}

Read relevant files in the codebase to understand the implementation, then generate one or more YAML specs verifying the acceptance criteria.`;
}
function flattenAdf(node) {
    if (!node)
        return "";
    if (typeof node === "string")
        return node;
    if (node.text)
        return node.text;
    if (Array.isArray(node.content)) {
        return node.content.map(flattenAdf).join(node.type === "paragraph" ? "" : "\n");
    }
    return "";
}
//# sourceMappingURL=generate-from-issue.js.map