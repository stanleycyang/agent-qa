import { minimatch } from "minimatch";
import { AgentQASpec } from "./types.js";

export interface DiffAnalysisResult {
  changedFiles: string[];
  matchedSpecs: Array<{ spec: AgentQASpec; specPath: string }>;
}

export function analyzeChangedFiles(
  changedFiles: string[],
  specs: Array<{ spec: AgentQASpec; path: string }>
): DiffAnalysisResult {
  const matchedSpecs: Array<{ spec: AgentQASpec; specPath: string }> = [];
  
  for (const { spec, path: specPath } of specs) {
    const { trigger } = spec;
    
    if (!trigger.paths || trigger.paths.length === 0) {
      // No path triggers, include all specs by default
      matchedSpecs.push({ spec, specPath });
      continue;
    }
    
    // Check if any changed file matches any trigger pattern
    const hasMatch = changedFiles.some(file =>
      trigger.paths!.some(pattern => minimatch(file, pattern))
    );
    
    if (hasMatch) {
      matchedSpecs.push({ spec, specPath });
    }
  }
  
  return {
    changedFiles,
    matchedSpecs,
  };
}
