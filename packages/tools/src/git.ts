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
    const branch = (await this.git.revparse(["--abbrev-ref", "HEAD"])).trim();
    return { branch };
  }

  async getCurrentSha(): Promise<string> {
    return (await this.git.revparse(["HEAD"])).trim();
  }

  async show(ref: string): Promise<{ author: string; date: string; message: string; sha: string }> {
    const log = await this.git.show([ref, "--no-patch", "--format=%H%n%an%n%ai%n%s"]);
    const lines = log.split("\n").map(l => l.trim()).filter(Boolean);
    return {
      sha: lines[0] ?? "",
      author: lines[1] ?? "",
      date: lines[2] ?? "",
      message: lines[3] ?? "",
    };
  }

  async bisectStart(badRef: string, goodRef: string): Promise<void> {
    await this.git.raw(["bisect", "start", badRef, goodRef]);
  }

  async bisectMark(result: "good" | "bad"): Promise<{ done: boolean; sha?: string; message: string }> {
    const output = await this.git.raw(["bisect", result]);
    // Bisect finishes when output contains "is the first bad commit"
    const doneMatch = output.match(/([a-f0-9]{40}) is the first bad commit/);
    if (doneMatch) {
      return { done: true, sha: doneMatch[1], message: output };
    }
    return { done: false, message: output };
  }

  async bisectReset(): Promise<void> {
    try {
      await this.git.raw(["bisect", "reset"]);
    } catch {
      // No bisect in progress
    }
  }
}
