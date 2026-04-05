import { chromium } from "playwright";
export class BrowserTool {
    browser = null;
    page = null;
    consoleMessages = [];
    async launch(headless = true) {
        this.browser = await chromium.launch({ headless });
        this.page = await this.browser.newPage();
        this.page.on("console", (msg) => {
            this.consoleMessages.push({ type: msg.type(), text: msg.text() });
        });
        this.page.on("pageerror", (err) => {
            this.consoleMessages.push({ type: "error", text: err.message });
        });
    }
    async navigate(url) {
        if (!this.page)
            throw new Error("Browser not launched");
        await this.page.goto(url, { waitUntil: "networkidle" });
        return { success: true, url: this.page.url(), title: await this.page.title() };
    }
    async click(selector) {
        if (!this.page)
            throw new Error("Browser not launched");
        await this.page.click(selector);
        return { success: true };
    }
    async type(selector, text) {
        if (!this.page)
            throw new Error("Browser not launched");
        await this.page.fill(selector, text);
        return { success: true };
    }
    async screenshot(savePath) {
        if (!this.page)
            throw new Error("Browser not launched");
        const buffer = await this.page.screenshot({ path: savePath, fullPage: false });
        return { path: savePath, base64: buffer.toString("base64") };
    }
    async getContent() {
        if (!this.page)
            throw new Error("Browser not launched");
        const content = await this.page.content();
        return { content };
    }
    async getTitle() {
        if (!this.page)
            throw new Error("Browser not launched");
        const title = await this.page.title();
        return { title };
    }
    async waitForSelector(selector, timeout = 30000) {
        if (!this.page)
            throw new Error("Browser not launched");
        await this.page.waitForSelector(selector, { timeout });
        return { success: true };
    }
    async hover(selector) {
        if (!this.page)
            throw new Error("Browser not launched");
        await this.page.hover(selector);
        return { success: true };
    }
    async selectOption(selector, value) {
        if (!this.page)
            throw new Error("Browser not launched");
        await this.page.selectOption(selector, value);
        return { success: true };
    }
    async getAttribute(selector, attribute) {
        if (!this.page)
            throw new Error("Browser not launched");
        const value = await this.page.getAttribute(selector, attribute);
        return { value };
    }
    async getTextContent(selector) {
        if (!this.page)
            throw new Error("Browser not launched");
        const text = await this.page.textContent(selector);
        return { text };
    }
    async evaluateJs(expression) {
        if (!this.page)
            throw new Error("Browser not launched");
        const result = await this.page.evaluate(expression);
        return { result };
    }
    async getConsoleErrors() {
        const errors = this.consoleMessages.filter(m => m.type === "error" || m.type === "warning");
        return { errors };
    }
    async scroll(selector, direction = "down") {
        if (!this.page)
            throw new Error("Browser not launched");
        if (selector) {
            await this.page.locator(selector).scrollIntoViewIfNeeded();
        }
        else {
            await this.page.evaluate(`window.scrollBy(0, ${direction === "down" ? 500 : -500})`);
        }
        return { success: true };
    }
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            this.consoleMessages = [];
        }
    }
}
//# sourceMappingURL=browser.js.map