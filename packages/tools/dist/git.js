import simpleGit from "simple-git";
export class GitTool {
    git;
    constructor(repoPath = process.cwd()) {
        this.git = simpleGit(repoPath);
    }
    async getDiff(ref1, ref2) {
        const diff = ref1 && ref2
            ? await this.git.diff([`${ref1}...${ref2}`])
            : await this.git.diff();
        return { diff };
    }
    async listChangedFiles(ref1, ref2) {
        const args = ref1 && ref2 ? [`${ref1}...${ref2}`] : [];
        const diff = args.length > 0 ? await this.git.diffSummary(args) : await this.git.diffSummary();
        return { files: diff.files.map(f => f.file) };
    }
    async checkout(branch) {
        await this.git.checkout(branch);
        return { success: true };
    }
    async getCurrentBranch() {
        const branch = await this.git.revparse(["--abbrev-ref", "HEAD"]);
        return { branch };
    }
}
//# sourceMappingURL=git.js.map