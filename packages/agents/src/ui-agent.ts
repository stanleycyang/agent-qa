import Anthropic from "@anthropic-ai/sdk";
import { Scenario } from "@agentqa/core";
import { BrowserTool } from "@agentqa/tools";
import { BaseAgent } from "./base-agent.js";

export class UIAgent extends BaseAgent {
  private browser: BrowserTool;
  
  constructor(model?: string) {
    super(model);
    this.browser = new BrowserTool();
  }
  
  async initialize(): Promise<void> {
    await this.browser.launch();
  }
  
  async cleanup(): Promise<void> {
    await this.browser.close();
  }
  
  getTools(): Anthropic.Tool[] {
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
  
  async handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case "navigate":
        return this.browser.navigate(input.url as string);
      case "click":
        return this.browser.click(input.selector as string);
      case "type":
        return this.browser.type(input.selector as string, input.text as string);
      case "screenshot":
        return this.browser.screenshot();
      case "get_content":
        return this.browser.getContent();
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
  
  buildSystemPrompt(scenario: Scenario): string {
    return `You are a UI testing agent. Use the browser automation tools to execute the test scenario.

Navigate to pages, interact with elements, and verify the UI state matches expectations.

After completing all steps, evaluate each expectation and return a JSON result.`;
  }
}
