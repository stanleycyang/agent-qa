import axios from "axios";
/**
 * Build a context payload for the spec generator from a Figma URL.
 * Requires FIGMA_TOKEN env var (or config.integrations.figma_token).
 */
export async function buildFigmaContext(url, config) {
    const token = process.env.FIGMA_TOKEN ?? config.integrations?.figma_token;
    if (!token) {
        throw new Error("FIGMA_TOKEN is not set. Get one at https://www.figma.com/developers/api#access-tokens " +
            "and export it: export FIGMA_TOKEN=figd_...");
    }
    const parsed = parseFigmaUrl(url);
    if (!parsed) {
        throw new Error(`Invalid Figma URL: ${url}. Expected https://www.figma.com/file/{key}/...`);
    }
    // Fetch file metadata
    const headers = { "X-Figma-Token": token };
    let fileData;
    try {
        const resp = await axios.get(`https://api.figma.com/v1/files/${parsed.fileKey}`, { headers });
        fileData = resp.data;
    }
    catch (err) {
        throw new Error(`Figma API error: ${err.message}`);
    }
    // Fetch image render of the target node (or root)
    let imageUrl;
    const nodeId = parsed.nodeId ?? fileData.document?.children?.[0]?.id;
    if (nodeId) {
        try {
            const imgResp = await axios.get(`https://api.figma.com/v1/images/${parsed.fileKey}`, {
                headers,
                params: { ids: nodeId, format: "png", scale: 2 },
            });
            imageUrl = imgResp.data.images?.[nodeId];
        }
        catch {
            // Image render is optional
        }
    }
    // Build a compact text representation of the design
    const designSummary = summarizeFigmaNode(fileData.document, 0, 4);
    return `Generate AgentQA UI test specs that verify a web implementation matches this Figma design.

Figma file: ${fileData.name}
${imageUrl ? `Design image: ${imageUrl}\n` : ""}

Design structure (truncated):
${designSummary}

Generate web specs that:
1. Navigate to the implemented page (use base_url from environment)
2. Use check_visual_regression with descriptive baseline names for stable views
3. Use detect_visual_issues to catch broken layouts
4. Use assert_visual for natural-language design requirements (e.g. "header is dark blue with white logo on left")
5. Verify text content matches the design (key headings, button labels)`;
}
function parseFigmaUrl(url) {
    // Match https://www.figma.com/file/{key}/... or https://www.figma.com/design/{key}/...
    const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
    if (!match)
        return null;
    const fileKey = match[1];
    const nodeMatch = url.match(/node-id=([0-9-]+)/);
    const nodeId = nodeMatch ? nodeMatch[1].replace("-", ":") : undefined;
    return { fileKey, nodeId };
}
function summarizeFigmaNode(node, depth, maxDepth) {
    if (!node || depth > maxDepth)
        return "";
    const indent = "  ".repeat(depth);
    const type = node.type ?? "?";
    const name = node.name ?? "";
    let line = `${indent}${type}: ${name}`;
    if (node.characters)
        line += ` "${String(node.characters).substring(0, 60)}"`;
    if (node.absoluteBoundingBox) {
        const b = node.absoluteBoundingBox;
        line += ` [${Math.round(b.width)}x${Math.round(b.height)}]`;
    }
    let result = line + "\n";
    if (Array.isArray(node.children)) {
        for (const child of node.children.slice(0, 20)) {
            result += summarizeFigmaNode(child, depth + 1, maxDepth);
        }
    }
    return result;
}
//# sourceMappingURL=generate-from-figma.js.map