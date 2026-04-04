export function buildExecutionPlan(matchedSpecs, config) {
    return {
        specs: matchedSpecs.map(({ spec, specPath }) => ({
            spec,
            specPath,
            scenarios: spec.scenarios,
        })),
        environment: {
            base_url: config.environment?.preview_url,
            api_url: config.environment?.api_url,
        },
    };
}
//# sourceMappingURL=plan-builder.js.map