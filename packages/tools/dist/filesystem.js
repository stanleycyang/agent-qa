import * as fs from "fs/promises";
export class FilesystemTool {
    async readFile(filePath) {
        const content = await fs.readFile(filePath, "utf-8");
        return { content };
    }
    async listDir(dirPath) {
        const files = await fs.readdir(dirPath);
        return { files };
    }
    async grepFile(filePath, pattern) {
        const content = await fs.readFile(filePath, "utf-8");
        const regex = new RegExp(pattern, "g");
        const matches = content.match(regex) || [];
        return { matches };
    }
    async exists(filePath) {
        try {
            await fs.access(filePath);
            return { exists: true };
        }
        catch {
            return { exists: false };
        }
    }
}
//# sourceMappingURL=filesystem.js.map