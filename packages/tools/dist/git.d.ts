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
    getCurrentSha(): Promise<string>;
    show(ref: string): Promise<{
        author: string;
        date: string;
        message: string;
        sha: string;
    }>;
    bisectStart(badRef: string, goodRef: string): Promise<void>;
    bisectMark(result: "good" | "bad"): Promise<{
        done: boolean;
        sha?: string;
        message: string;
    }>;
    bisectReset(): Promise<void>;
}
//# sourceMappingURL=git.d.ts.map