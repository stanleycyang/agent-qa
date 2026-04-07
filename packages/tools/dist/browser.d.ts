export declare class BrowserTool {
    private browser;
    private page;
    private consoleMessages;
    launch(headless?: boolean): Promise<void>;
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