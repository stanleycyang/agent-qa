export type BrowserType = "chromium" | "firefox" | "webkit";
export interface BrowserLaunchOptions {
    headless?: boolean;
    browserType?: BrowserType;
    viewport?: {
        width: number;
        height: number;
    };
    recordVideoDir?: string;
}
export declare class BrowserTool {
    private browser;
    private context;
    private page;
    private consoleMessages;
    private networkLog;
    private currentVideoDir?;
    launch(options?: BrowserLaunchOptions | boolean): Promise<void>;
    /** Get the captured network log for the current session. */
    getNetworkLog(): typeof this.networkLog;
    /** Get all captured console messages. */
    getConsoleMessages(): typeof this.consoleMessages;
    /** Get the path to the recorded video, if recording was enabled. */
    getVideoPath(): Promise<string | null>;
    navigate(url: string): Promise<{
        success: boolean;
        url: string;
        title: string;
    }>;
    click(selector: string): Promise<{
        success: boolean;
    }>;
    type(selector: string, text: string): Promise<{
        success: boolean;
    }>;
    screenshot(savePath?: string): Promise<{
        path?: string;
        base64: string;
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
    hover(selector: string): Promise<{
        success: boolean;
    }>;
    selectOption(selector: string, value: string): Promise<{
        success: boolean;
    }>;
    getAttribute(selector: string, attribute: string): Promise<{
        value: string | null;
    }>;
    getTextContent(selector: string): Promise<{
        text: string | null;
    }>;
    evaluateJs(expression: string): Promise<{
        result: unknown;
    }>;
    /** Inject a script (URL or inline content) into the current page. */
    injectScript(options: {
        url?: string;
        content?: string;
    }): Promise<{
        success: boolean;
    }>;
    getConsoleErrors(): Promise<{
        errors: Array<{
            type: string;
            text: string;
        }>;
    }>;
    scroll(selector?: string, direction?: "up" | "down"): Promise<{
        success: boolean;
    }>;
    /**
     * Try to find an element matching a description by searching the DOM for
     * common attributes (data-testid, aria-label, role, text content).
     * Returns the first matching CSS selector or null.
     * The eval function runs in the browser context where DOM globals exist.
     */
    findElementByDescription(description: string): Promise<{
        selector: string | null;
        matches: string[];
    }>;
    close(): Promise<void>;
}
//# sourceMappingURL=browser.d.ts.map