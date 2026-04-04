import * as fs from "fs/promises";
import * as path from "path";

export class FilesystemTool {
  async readFile(filePath: string): Promise<{ content: string }> {
    const content = await fs.readFile(filePath, "utf-8");
    return { content };
  }
  
  async listDir(dirPath: string): Promise<{ files: string[] }> {
    const files = await fs.readdir(dirPath);
    return { files };
  }
  
  async grepFile(filePath: string, pattern: string): Promise<{ matches: string[] }> {
    const content = await fs.readFile(filePath, "utf-8");
    const regex = new RegExp(pattern, "g");
    const matches = content.match(regex) || [];
    return { matches };
  }
  
  async exists(filePath: string): Promise<{ exists: boolean }> {
    try {
      await fs.access(filePath);
      return { exists: true };
    } catch {
      return { exists: false };
    }
  }
}
