export declare class BrowserTool {
    private browser;
    private page;
    launch(headless?: boolean): Promise<void>;
    navigate(url: string): Promise<{
        success: boolean;
        url: string;
    }>;
    click(selector: string): Promise<{
        success: boolean;
    }>;
    type(selector: string, text: string): Promise<{
        success: boolean;
    }>;
    screenshot(path?: string): Promise<{
        path?: string;
        buffer?: Buffer;
    }>;
    getContent(): Promise<{
        content: string;
    }>;
    getTitle(): Promise<{
        title: string;
    }>;
    waitForSelector(selector: string, timeout?: number): Promise<{
        success: boolean;
    }>;
    close(): Promise<void>;
}
//# sourceMappingURL=browser.d.ts.map