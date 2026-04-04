import simpleGit, { SimpleGit } from "simple-git";

export class GitTool {
  private git: SimpleGit;
  
  constructor(repoPath: string = process.cwd()) {
    this.git = simpleGit(repoPath);
  }
  
  async getDiff(ref1?: string, ref2?: string): Promise<{ diff: string }> {
    const diff = ref1 && ref2 
      ? await this.git.diff([`${ref1}...${ref2}`])
      : await this.git.diff();
    return { diff };
  }
  
  async listChangedFiles(ref1?: string, ref2?: string): Promise<{ files: string[] }> {
    const args = ref1 && ref2 ? [`${ref1}...${ref2}`] : [];
    const diff = args.length > 0 ? await this.git.diffSummary(args) : await this.git.diffSummary();
    return { files: diff.files.map(f => f.file) };
  }
  
  async checkout(branch: string): Promise<{ success: boolean }> {
    await this.git.checkout(branch);
    return { success: true };
  }
  
  async getCurrentBranch(): Promise<{ branch: string }> {
    const branch = await this.git.revparse(["--abbrev-ref", "HEAD"]);
    return { branch };
  }
}
