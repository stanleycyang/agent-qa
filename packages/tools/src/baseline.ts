import * as fs from "fs/promises";
import * as path from "path";

/**
 * Manages baseline screenshots for visual regression testing.
 * Baselines are stored in .agentqa/baselines/{spec}/{scenario}/{name}.png
 * and should be committed to git alongside the spec files.
 */
export class BaselineStore {
  constructor(private baselineDir: string) {}

  private getPath(specName: string, scenarioName: string, baselineName: string): string {
    const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, "-");
    return path.join(this.baselineDir, safe(specName), safe(scenarioName), `${safe(baselineName)}.png`);
  }

  async exists(specName: string, scenarioName: string, baselineName: string): Promise<boolean> {
    try {
      await fs.access(this.getPath(specName, scenarioName, baselineName));
      return true;
    } catch {
      return false;
    }
  }

  async load(specName: string, scenarioName: string, baselineName: string): Promise<string | null> {
    try {
      const buffer = await fs.readFile(this.getPath(specName, scenarioName, baselineName));
      return buffer.toString("base64");
    } catch {
      return null;
    }
  }

  async save(specName: string, scenarioName: string, baselineName: string, base64: string): Promise<string> {
    const filePath = this.getPath(specName, scenarioName, baselineName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(base64, "base64"));
    return filePath;
  }
}
