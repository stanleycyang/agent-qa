import { AgentQASpec, AgentQAConfig } from "./types.js";
export declare function parseSpec(filePath: string): Promise<AgentQASpec>;
export declare function parseConfig(configPath: string): Promise<AgentQAConfig>;
export declare function loadAllSpecs(specsDir: string): Promise<Array<{
    spec: AgentQASpec;
    path: string;
}>>;
//# sourceMappingURL=spec-parser.d.ts.map