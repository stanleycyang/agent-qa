export declare class FilesystemTool {
    readFile(filePath: string): Promise<{
        content: string;
    }>;
    listDir(dirPath: string): Promise<{
        files: string[];
    }>;
    grepFile(filePath: string, pattern: string): Promise<{
        matches: string[];
    }>;
    exists(filePath: string): Promise<{
        exists: boolean;
    }>;
}
//# sourceMappingURL=filesystem.d.ts.map