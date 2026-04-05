import { chromium, Browser, Page } from "playwright";

export class BrowserTool {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private consoleMessages: Array<{ type: string; text: string }> = [];

  async launch(headless = true): Promise<void> {
    this.browser = await chromium.launch({ headless });
    this.page = await this.browser.newPage();
    this.page.on("console", (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on("pageerror", (err) => {
      this.consoleMessages.push({ type: "error", text: err.message });
    });
  }

  async navigate(url: string): Promise<{ success: boolean; url: string; title: string }> {
    if (!this.page) throw new Error("Browser not launched");
    await this.page.goto(url, { waitUntil: "networkidle" });
    return { success: true, url: this.page.url(), title: await this.page.title() };
  }

  async click(selector: string): Promise<{ success: boolean }> {
    if (!this.page) throw new Error("Browser not launched");
    await this.page.click(selector);
    return { success: true };
  }

  async type(selector: string, text: string): Promise<{ success: boolean }> {
    if (!this.page) throw new Error("Browser not launched");
    await this.page.fill(selector, text);
    return { success: true };
  }

  async screenshot(savePath?: string): Promise<{ path?: string; base64: string }> {
    if (!this.page) throw new Error("Browser not launched");
    const buffer = await this.page.screenshot({ path: savePath, fullPage: false });
    return { path: savePath, base64: buffer.toString("base64") };
  }

  async getContent(): Promise<{ content: string }> {
    if (!this.page) throw new Error("Browser not launched");
    const content = await this.page.content();
    return { content };
  }

  async getTitle(): Promise<{ title: string }> {
    if (!this.page) throw new Error("Browser not launched");
    const title = await this.page.title();
    return { title };
  }

  async waitForSelector(selector: string, timeout = 30000): Promise<{ success: boolean }> {
    if (!this.page) throw new Error("Browser not launched");
    await this.page.waitForSelector(selector, { timeout });
    return { success: true };
  }

  async hover(selector: string): Promise<{ success: boolean }> {
    if (!this.page) throw new Error("Browser not launched");
    await this.page.hover(selector);
    return { success: true };
  }

  async selectOption(selector: string, value: string): Promise<{ success: boolean }> {
    if (!this.page) throw new Error("Browser not launched");
    await this.page.selectOption(selector, value);
    return { success: true };
  }

  async getAttribute(selector: string, attribute: string): Promise<{ value: string | null }> {
    if (!this.page) throw new Error("Browser not launched");
    const value = await this.page.getAttribute(selector, attribute);
    return { value };
  }

  async getTextContent(selector: string): Promise<{ text: string | null }> {
    if (!this.page) throw new Error("Browser not launched");
    const text = await this.page.textContent(selector);
    return { text };
  }

  async evaluateJs(expression: string): Promise<{ result: unknown }> {
    if (!this.page) throw new Error("Browser not launched");
    const result = await this.page.evaluate(expression);
    return { result };
  }

  async getConsoleErrors(): Promise<{ errors: Array<{ type: string; text: string }> }> {
    const errors = this.consoleMessages.filter(m => m.type === "error" || m.type === "warning");
    return { errors };
  }

  async scroll(selector?: string, direction: "up" | "down" = "down"): Promise<{ success: boolean }> {
    if (!this.page) throw new Error("Browser not launched");
    if (selector) {
      await this.page.locator(selector).scrollIntoViewIfNeeded();
    } else {
      await this.page.evaluate(`window.scrollBy(0, ${direction === "down" ? 500 : -500})`);
    }
    return { success: true };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.consoleMessages = [];
    }
  }
}
