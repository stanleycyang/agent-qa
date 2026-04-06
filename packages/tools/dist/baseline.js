import * as fs from "fs/promises";
import * as path from "path";
/**
 * Manages baseline screenshots for visual regression testing.
 * Baselines are stored in .agentqa/baselines/{spec}/{scenario}/{name}.png
 * and should be committed to git alongside the spec files.
 */
export class BaselineStore {
    baselineDir;
    constructor(baselineDir) {
        this.baselineDir = baselineDir;
    }
    getPath(specName, scenarioName, baselineName) {
        const safe = (s) => s.replace(/[^a-zA-Z0-9._-]/g, "-");
        return path.join(this.baselineDir, safe(specName), safe(scenarioName), `${safe(baselineName)}.png`);
    }
    async exists(specName, scenarioName, baselineName) {
        try {
            await fs.access(this.getPath(specName, scenarioName, baselineName));
            return true;
        }
        catch {
            return false;
        }
    }
    async load(specName, scenarioName, baselineName) {
        try {
            const buffer = await fs.readFile(this.getPath(specName, scenarioName, baselineName));
            return buffer.toString("base64");
        }
        catch {
            return null;
        }
    }
    async save(specName, scenarioName, baselineName, base64) {
        const filePath = this.getPath(specName, scenarioName, baselineName);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, Buffer.from(base64, "base64"));
        return filePath;
    }
}
//# sourceMappingURL=baseline.js.map