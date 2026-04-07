export interface WrittenSpec {
    filePath: string;
    name: string;
}
/**
 * Write a spec object to a YAML file in the specs directory.
 * Returns the file path. Refuses to overwrite existing files unless force=true.
 */
export declare function writeSpec(specsDir: string, spec: Record<string, unknown>, options?: {
    force?: boolean;
    filename?: string;
}): Promise<WrittenSpec>;
/**
 * Extract YAML blocks from a string of agent output.
 * Agents often emit specs as fenced code blocks.
 */
export declare function extractYamlBlocks(text: string): Array<Record<string, unknown>>;
//# sourceMappingURL=spec-writer.d.ts.map