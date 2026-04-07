import { chromium, firefox, webkit } from "playwright";
export class BrowserTool {
    browser = null;
    context = null;
    page = null;
    consoleMessages = [];
    networkLog = [];
    currentVideoDir;
    async launch(options = true) {
        // Backward compat: launch(true/false) = headless toggle on chromium
        const opts = typeof options === "boolean"
            ? { headless: options }
            : options;
        const { headless = true, browserType = "chromium", viewport, recordVideoDir } = opts;
        this.currentVideoDir = recordVideoDir;
        const launcher = browserType === "firefox" ? firefox : browserType === "webkit" ? webkit : chromium;
        this.browser = await launcher.launch({ headless });
        this.context = await this.browser.newContext({
            viewport: viewport ?? null,
            recordVideo: recordVideoDir ? { dir: recordVideoDir } : undefined,
        });
        this.page = await this.context.newPage();
        this.page.on("console", (msg) => {
            this.consoleMessages.push({ type: msg.type(), text: msg.text() });
        });
        this.page.on("pageerror", (err) => {
            this.consoleMessages.push({ type: "error", text: err.message });
        });
        this.page.on("request", (req) => {
            this.networkLog.push({ method: req.method(), url: req.url(), timestamp: Date.now() });
        });
        this.page.on("response", (resp) => {
            const entry = this.networkLog.find(e => e.url === resp.url() && e.status === undefined);
            if (entry)
                entry.status = resp.status();
        });
    }
    /** Get the captured network log for the current session. */
    getNetworkLog() {
        return this.networkLog;
    }
    /** Get all captured console messages. */
    getConsoleMessages() {
        return this.consoleMessages;
    }
    /** Get the path to the recorded video, if recording was enabled. */
    async getVideoPath() {
        if (!this.currentVideoDir || !this.page)
            return null;
        const video = this.page.video();
        if (!video)
            return null;
        try {
            return await video.path();
        }
        catch {
            return null;
        }
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
    /** Inject a script (URL or inline content) into the current page. */
    async injectScript(options) {
        if (!this.page)
            throw new Error("Browser not launched");
        await this.page.addScriptTag(options);
        return { success: true };
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
    /**
     * Try to find an element matching a description by searching the DOM for
     * common attributes (data-testid, aria-label, role, text content).
     * Returns the first matching CSS selector or null.
     * The eval function runs in the browser context where DOM globals exist.
     */
    async findElementByDescription(description) {
        if (!this.page)
            throw new Error("Browser not launched");
        const candidates = await this.page.evaluate(`(() => {
      const desc = ${JSON.stringify(description.toLowerCase())};
      const results = [];
      const tokens = desc.split(/\\s+/).filter(Boolean);
      const elements = document.querySelectorAll("button, a, input, [role], [data-testid], [aria-label]");
      for (const el of Array.from(elements)) {
        const text = (el.textContent || "").trim().toLowerCase();
        const aria = (el.getAttribute("aria-label") || "").toLowerCase();
        const testid = el.getAttribute("data-testid") || "";
        const placeholder = (el.getAttribute("placeholder") || "").toLowerCase();
        const score = tokens.filter(t => text.includes(t) || aria.includes(t) || placeholder.includes(t)).length;
        if (score > 0) {
          if (testid) {
            results.push('[data-testid="' + testid + '"]');
          } else if (el.getAttribute("aria-label")) {
            results.push('[aria-label="' + el.getAttribute("aria-label") + '"]');
          } else if (el.id) {
            results.push("#" + el.id);
          } else {
            results.push(el.tagName.toLowerCase() + ':has-text("' + text.substring(0, 40) + '")');
          }
        }
      }
      return results.slice(0, 5);
    })()`);
        return { selector: candidates[0] ?? null, matches: candidates };
    }
    async close() {
        if (this.context) {
            await this.context.close();
            this.context = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            this.consoleMessages = [];
            this.networkLog = [];
        }
    }
}
//# sourceMappingURL=browser.js.map