import { chromium, Browser, Page } from "playwright";

export class BrowserTool {
  private browser: Browser | null = null;
  private page: Page | null = null;
  
  async launch(headless = true): Promise<void> {
    this.browser = await chromium.launch({ headless });
    this.page = await this.browser.newPage();
  }
  
  async navigate(url: string): Promise<{ success: boolean; url: string }> {
    if (!this.page) throw new Error("Browser not launched");
    await this.page.goto(url, { waitUntil: "networkidle" });
    return { success: true, url: this.page.url() };
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
  
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
