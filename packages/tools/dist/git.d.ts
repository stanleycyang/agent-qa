export declare class GitTool {
    private git;
    constructor(repoPath?: string);
    getDiff(ref1?: string, ref2?: string): Promise<{
        diff: string;
    }>;
    listChangedFiles(ref1?: string, ref2?: string): Promise<{
        files: string[];
    }>;
    checkout(branch: string): Promise<{
        success: boolean;
    }>;
    getCurrentBranch(): Promise<{
        branch: string;
    }>;
}
//# sourceMappingURL=git.d.ts.map