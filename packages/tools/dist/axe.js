const AXE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";
/**
 * Inject axe-core into the current page and run an accessibility audit.
 * Returns WCAG violations grouped by severity.
 */
export async function runAxeAudit(browser) {
    // Inject axe-core from CDN
    await browser.injectScript({ url: AXE_CDN });
    // Run axe and collect results
    const result = await browser.evaluateJs(`(async () => {
    if (typeof axe === "undefined") return { error: "axe-core failed to load" };
    const r = await axe.run();
    return {
      violations: r.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.slice(0, 5).map(n => ({
          target: n.target,
          html: n.html.substring(0, 200),
          failureSummary: n.failureSummary,
        })),
      })),
      passes: r.passes.length,
      incomplete: r.incomplete.length,
      url: r.url,
    };
  })()`);
    return result.result;
}
//# sourceMappingURL=axe.js.map