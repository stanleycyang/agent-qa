import { chromium } from "playwright";
export class BrowserTool {
    browser = null;
    page = null;
    async launch(headless = true) {
        this.browser = await chromium.launch({ headless });
        this.page = await this.browser.newPage();
    }
    async navigate(url) {
        if (!this.page)
            throw new Error("Browser not launched");
        await this.page.goto(url, { waitUntil: "networkidle" });
        return { success: true, url: this.page.url() };
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
    async screenshot(path) {
        if (!this.page)
            throw new Error("Browser not launched");
        const buffer = await this.page.screenshot({ path, fullPage: false });
        return { path, buffer };
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
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}
//# sourceMappingURL=browser.js.map