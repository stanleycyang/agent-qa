import { AgentQASpec, ExecutionPlan, AgentQAConfig } from "./types.js";

export function buildExecutionPlan(
  matchedSpecs: Array<{ spec: AgentQASpec; specPath: string }>,
  config: AgentQAConfig
): ExecutionPlan {
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
