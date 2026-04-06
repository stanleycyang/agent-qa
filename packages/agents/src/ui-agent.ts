import Anthropic from "@anthropic-ai/sdk";
import { Scenario } from "@agentqa/core";
import { BrowserTool, AssertionEngine, BaselineStore } from "@agentqa/tools";
import { BaseAgent } from "./base-agent.js";

export interface UIAgentOptions {
  model?: string;
  baselineStore?: BaselineStore;
  specName?: string;
  updateBaselines?: boolean;
}

export class UIAgent extends BaseAgent {
  private browser: BrowserTool;
  private assertions: AssertionEngine;
  private baselineStore?: BaselineStore;
  private specName?: string;
  private updateBaselines: boolean;
  private currentScenarioName: string = "";

  constructor(modelOrOptions?: string | UIAgentOptions) {
    const options: UIAgentOptions = typeof modelOrOptions === "string"
      ? { model: modelOrOptions }
      : (modelOrOptions ?? {});
    super(options.model);
    this.browser = new BrowserTool();
    this.assertions = new AssertionEngine();
    this.baselineStore = options.baselineStore;
    this.specName = options.specName;
    this.updateBaselines = options.updateBaselines ?? false;
  }

  async runScenario(scenario: Scenario, environment: Record<string, string>) {
    this.currentScenarioName = scenario.name;
    return super.runScenario(scenario, environment);
  }

  async initialize(): Promise<void> {
    await this.browser.launch();
  }

  async cleanup(): Promise<void> {
    await this.browser.close();
  }

  async captureScreenshot(savePath: string): Promise<string> {
    const result = await this.browser.screenshot(savePath);
    return result.base64;
  }

  getTools(): Anthropic.Tool[] {
    return [
      {
        name: "navigate",
        description: "Navigate the browser to a URL. Returns the final URL and page title after load.",
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
        description: "Click an element by CSS selector. Use specific selectors like button[type='submit'], a[href='/cart'], or [data-testid='checkout-btn']. If you don't know the exact selector, use get_content first to inspect the page.",
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
        description: "Type text into an input field. Clears existing content first.",
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
        description: "Take a screenshot of the current page. Returns a base64-encoded image. Use this to visually verify the page state.",
        input_schema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "get_content",
        description: "Get the full HTML content of the current page. Useful for finding selectors and verifying text content.",
        input_schema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "wait_for_selector",
        description: "Wait for an element to appear in the DOM. Use this after navigation or actions that trigger dynamic content loading.",
        input_schema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector to wait for" },
            timeout: { type: "number", description: "Max wait time in ms (default: 30000)" }
          },
          required: ["selector"]
        }
      },
      {
        name: "get_text",
        description: "Get the text content of a specific element by CSS selector.",
        input_schema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector for the element" }
          },
          required: ["selector"]
        }
      },
      {
        name: "get_attribute",
        description: "Get the value of an HTML attribute on an element.",
        input_schema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector for the element" },
            attribute: { type: "string", description: "Attribute name (e.g. 'href', 'value', 'data-testid')" }
          },
          required: ["selector", "attribute"]
        }
      },
      {
        name: "hover",
        description: "Hover over an element. Useful for triggering tooltips, dropdown menus, or hover states.",
        input_schema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector for the element" }
          },
          required: ["selector"]
        }
      },
      {
        name: "select_option",
        description: "Select an option from a <select> dropdown by value.",
        input_schema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector for the <select> element" },
            value: { type: "string", description: "Option value to select" }
          },
          required: ["selector", "value"]
        }
      },
      {
        name: "scroll",
        description: "Scroll the page or scroll a specific element into view.",
        input_schema: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector to scroll into view. Omit to scroll the page." },
            direction: { type: "string", enum: ["up", "down"], description: "Scroll direction when no selector (default: down)" }
          },
          required: []
        }
      },
      {
        name: "execute_js",
        description: "Execute JavaScript in the browser context. Returns the evaluation result. Use for custom checks like form validation state, localStorage, or computed styles.",
        input_schema: {
          type: "object",
          properties: {
            expression: { type: "string", description: "JavaScript expression to evaluate" }
          },
          required: ["expression"]
        }
      },
      {
        name: "get_console_errors",
        description: "Get all console errors and warnings captured since page load. Use to check for JavaScript errors.",
        input_schema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "assert_visual",
        description: "Use AI vision to semantically verify if the current page matches an expectation. Takes a screenshot and uses a separate LLM to evaluate it. Returns pass/fail with confidence and reasoning. Use this for visual assertions that are hard to verify with selectors alone.",
        input_schema: {
          type: "object",
          properties: {
            expectation: { type: "string", description: "What the page should look like or contain (natural language)" }
          },
          required: ["expectation"]
        }
      },
      {
        name: "check_visual_regression",
        description: "Compare the current page against a stored baseline screenshot to detect visual regressions. On first run (or in --update-baselines mode), saves the current state as the baseline. On subsequent runs, uses AI vision to detect meaningful differences (layout shifts, missing elements, broken styling). Use this when you want pixel-stable verification of a critical view.",
        input_schema: {
          type: "object",
          properties: {
            baseline_name: { type: "string", description: "Name for this baseline (e.g. 'homepage', 'checkout-form'). Used as the filename." },
            context: { type: "string", description: "Optional context about what the page should look like, to help the vision model ignore irrelevant differences." }
          },
          required: ["baseline_name"]
        }
      },
      {
        name: "detect_visual_issues",
        description: "Proactively scan the current page for visual breakages and UX issues WITHOUT a baseline. Uses AI vision to find: layout bugs, text overflow, broken images, misaligned elements, missing content, accessibility issues. Returns a list of issues with severity. Use this as a safety net on every important page.",
        input_schema: {
          type: "object",
          properties: {
            context: { type: "string", description: "Optional context about the page (e.g. 'product detail page for a checkout flow')" }
          },
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
      case "wait_for_selector":
        return this.browser.waitForSelector(input.selector as string, (input.timeout as number) ?? 30000);
      case "get_text":
        return this.browser.getTextContent(input.selector as string);
      case "get_attribute":
        return this.browser.getAttribute(input.selector as string, input.attribute as string);
      case "hover":
        return this.browser.hover(input.selector as string);
      case "select_option":
        return this.browser.selectOption(input.selector as string, input.value as string);
      case "scroll":
        return this.browser.scroll(input.selector as string | undefined, (input.direction as "up" | "down") ?? "down");
      case "execute_js":
        return this.browser.evaluateJs(input.expression as string);
      case "get_console_errors":
        return this.browser.getConsoleErrors();
      case "assert_visual": {
        const screenshot = await this.browser.screenshot();
        return this.assertions.assertScreenshot(screenshot.base64, input.expectation as string);
      }
      case "check_visual_regression": {
        const screenshot = await this.browser.screenshot();
        const baselineName = input.baseline_name as string;
        const context = input.context as string | undefined;

        if (!this.baselineStore || !this.specName) {
          return {
            pass: false,
            confidence: 0,
            reasoning: "Baseline store not configured. Visual regression testing requires a baseline directory.",
            differences: [],
          };
        }

        const hasBaseline = await this.baselineStore.exists(this.specName, this.currentScenarioName, baselineName);

        // Create baseline on first run or in update mode
        if (!hasBaseline || this.updateBaselines) {
          const savedPath = await this.baselineStore.save(
            this.specName,
            this.currentScenarioName,
            baselineName,
            screenshot.base64,
          );
          return {
            pass: true,
            confidence: 1.0,
            reasoning: hasBaseline
              ? `Baseline updated at ${savedPath}`
              : `No baseline existed — created new baseline at ${savedPath}. Commit it to git and re-run to enable regression testing.`,
            differences: [],
            baseline_created: true,
          };
        }

        // Compare against existing baseline
        const baselineBase64 = await this.baselineStore.load(this.specName, this.currentScenarioName, baselineName);
        if (!baselineBase64) {
          return {
            pass: false,
            confidence: 0,
            reasoning: "Failed to load baseline",
            differences: [],
          };
        }

        return this.assertions.compareScreenshots(screenshot.base64, baselineBase64, context);
      }
      case "detect_visual_issues": {
        const screenshot = await this.browser.screenshot();
        return this.assertions.detectVisualIssues(screenshot.base64, input.context as string | undefined);
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  buildSystemPrompt(scenario: Scenario): string {
    return `You are a UI testing agent that automates browser interactions and verifies web application behavior.

## Your approach
1. **Navigate** to the target URL from the environment's base_url
2. **Execute steps** one at a time — interact with the page using click, type, select, etc.
3. **Wait for dynamic content** — after clicks or navigation, use wait_for_selector before checking results
4. **Gather evidence** — before evaluating expectations, use get_content, get_text, or screenshot to collect proof
5. **Verify expectations** — evaluate each expectation against the evidence you gathered

## Tool selection guidance
- Use **get_content** first when you need to discover selectors on the page
- Use **wait_for_selector** after any action that triggers navigation or dynamic loading
- Use **assert_visual** for one-off visual expectations ("the checkout button is prominent")
- Use **check_visual_regression** for pixel-stable critical views — compares against a saved baseline
- Use **detect_visual_issues** as a safety net — proactively finds broken layout, overflow, broken images, missing content WITHOUT needing a baseline
- Use **get_text** for specific text content verification
- Use **get_console_errors** to check for JavaScript errors if something seems broken
- Use **execute_js** for checking things not visible in HTML (localStorage, cookies, computed styles)
- Use **scroll** before interacting with elements that may be below the fold

## Visual testing strategy
When the scenario involves visual verification:
1. For critical UI that must remain stable: use **check_visual_regression** with a descriptive baseline_name
2. For open-ended "does it look right?" checks: use **detect_visual_issues** — it will flag layout bugs, text overflow, broken images, and other UX breakages without needing a reference
3. For natural language visual claims: use **assert_visual**
4. Combine **detect_visual_issues** + **get_console_errors** for a thorough "is this page healthy?" check

## Error recovery
- If a click fails, try get_content to find the right selector
- If an element isn't found, try wait_for_selector with a timeout
- If a page doesn't load, check get_console_errors for JavaScript errors
- Report exactly what you observed, even if the test fails

## Evidence and confidence
- **confidence 0.9-1.0**: Direct evidence (exact text match, element exists with expected content)
- **confidence 0.7-0.8**: Indirect evidence (similar text, element exists but content is close)
- **confidence 0.5-0.6**: Ambiguous (partial match, could be interpreted either way)
- **confidence < 0.5**: No evidence found or contradictory evidence
- Always include evidence: what you actually saw (text, URL, selector content)

## Output format
After completing all steps, return your result as a JSON code block:
\`\`\`json
{
  "status": "pass" | "fail" | "error",
  "expectations": [
    { "text": "the expectation text", "status": "pass" | "fail", "confidence": 0.95, "evidence": "what you actually observed", "reasoning": "why this passes or fails" }
  ],
  "summary": "brief overall summary"
}
\`\`\``;
  }
}
