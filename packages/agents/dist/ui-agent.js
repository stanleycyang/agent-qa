import { BrowserTool } from "@agentqa/tools";
import { BaseAgent } from "./base-agent.js";
export class UIAgent extends BaseAgent {
    browser;
    constructor(model) {
        super(model);
        this.browser = new BrowserTool();
    }
    async initialize() {
        await this.browser.launch();
    }
    async cleanup() {
        await this.browser.close();
    }
    async captureScreenshot(savePath) {
        const result = await this.browser.screenshot(savePath);
        return result.base64;
    }
    getTools() {
        return [
            {
                name: "navigate",
                description: "Navigate the browser to a URL",
                input_schema: {
                    type: "object",
                    properties: {
                        url: { type: "string", description: "The URL to navigate to" }
                    },
                    required: ["url"]
                }
            },
            {
                name: "click",
                description: "Click an element by CSS selector",
                input_schema: {
                    type: "object",
                    properties: {
                        selector: { type: "string", description: "CSS selector for the element" }
                    },
                    required: ["selector"]
                }
            },
            {
                name: "type",
                description: "Type text into an input field",
                input_schema: {
                    type: "object",
                    properties: {
                        selector: { type: "string", description: "CSS selector for the input" },
                        text: { type: "string", description: "Text to type" }
                    },
                    required: ["selector", "text"]
                }
            },
            {
                name: "screenshot",
                description: "Take a screenshot of the current page",
                input_schema: {
                    type: "object",
                    properties: {},
                    required: []
                }
            },
            {
                name: "get_content",
                description: "Get the HTML content of the current page",
                input_schema: {
                    type: "object",
                    properties: {},
                    required: []
                }
            }
        ];
    }
    async handleToolCall(name, input) {
        switch (name) {
            case "navigate":
                return this.browser.navigate(input.url);
            case "click":
                return this.browser.click(input.selector);
            case "type":
                return this.browser.type(input.selector, input.text);
            case "screenshot":
                return this.browser.screenshot();
            case "get_content":
                return this.browser.getContent();
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    buildSystemPrompt(scenario) {
        return `You are a UI testing agent. Use the browser automation tools to execute the test scenario.

Navigate to pages, interact with elements, and verify the UI state matches expectations.

After completing all steps, evaluate each expectation and return a JSON result.`;
    }
}
//# sourceMappingURL=ui-agent.js.map