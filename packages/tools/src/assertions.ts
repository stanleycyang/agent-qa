import Anthropic from "@anthropic-ai/sdk";

export interface AssertionResult {
  pass: boolean;
  confidence: number;
  reasoning: string;
}

export interface VisualComparisonResult extends AssertionResult {
  differences?: string[];
}

export interface VisualIssue {
  severity: "critical" | "warning" | "info";
  category: "layout" | "overflow" | "broken_image" | "missing_element" | "accessibility" | "other";
  description: string;
  location?: string;
}

export class AssertionEngine {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async assertText(
    text: string,
    expectation: string,
    model = "claude-sonnet-4-20250514"
  ): Promise<AssertionResult> {
    const response = await this.client.messages.create({
      model,
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `Given this text content:\n\n${text}\n\nDoes it satisfy this expectation: "${expectation}"?\n\nRespond with JSON: { "pass": true/false, "confidence": 0.0-1.0, "reasoning": "..." }`
      }]
    });

    return parseAssertionResponse(response);
  }

  async assertScreenshot(
    screenshotBase64: string,
    expectation: string,
    model = "claude-sonnet-4-20250514"
  ): Promise<AssertionResult> {
    const response = await this.client.messages.create({
      model,
      max_tokens: 512,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: screenshotBase64,
            },
          },
          {
            type: "text",
            text: `Does this screenshot satisfy this expectation: "${expectation}"?\n\nRespond with JSON: { "pass": true/false, "confidence": 0.0-1.0, "reasoning": "..." }`
          }
        ]
      }]
    });

    return parseAssertionResponse(response);
  }

  /**
   * Compare a current screenshot against a baseline image and detect visual regressions.
   * Uses a vision LLM to identify meaningful differences (not pixel-level noise).
   */
  async compareScreenshots(
    currentBase64: string,
    baselineBase64: string,
    context?: string,
    model = "claude-sonnet-4-20250514"
  ): Promise<VisualComparisonResult> {
    const contextPrompt = context
      ? `\n\nContext: ${context}\n\nThe test expects the page to look like the baseline.`
      : "";

    const response = await this.client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Compare these two screenshots. The first is the BASELINE (expected). The second is the CURRENT (actual).${contextPrompt}

Identify any meaningful visual differences that would indicate a regression:
- Layout shifts (elements moved, resized, or reordered)
- Missing or added elements (buttons, text, images)
- Broken styling (colors, fonts, alignment, spacing)
- Broken images or icons
- Text overflow or truncation
- Overlapping elements

Ignore: minor anti-aliasing differences, cursor position, scroll position (unless it changes visible content).

Respond with JSON:
{
  "pass": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "overall assessment",
  "differences": ["list", "of", "specific", "differences", "found"]
}

pass=true means no meaningful regression. pass=false means a real visual regression was detected.`
          },
          {
            type: "text",
            text: "BASELINE:"
          },
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: baselineBase64 },
          },
          {
            type: "text",
            text: "CURRENT:"
          },
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: currentBase64 },
          },
        ]
      }]
    });

    const textBlock = response.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined;
    if (!textBlock) {
      return { pass: false, confidence: 0, reasoning: "No response from vision model", differences: [] };
    }

    try {
      const parsed = extractJson(textBlock.text);
      return {
        pass: parsed.pass ?? false,
        confidence: parsed.confidence ?? 0,
        reasoning: parsed.reasoning ?? "",
        differences: parsed.differences ?? [],
      };
    } catch {
      return { pass: false, confidence: 0, reasoning: "Failed to parse vision model response", differences: [] };
    }
  }

  /**
   * Proactively scan a screenshot for visual breakages without a baseline.
   * Detects things a human reviewer would flag: layout bugs, broken images,
   * text overflow, misaligned elements, accessibility issues.
   */
  async detectVisualIssues(
    screenshotBase64: string,
    context?: string,
    model = "claude-sonnet-4-20250514"
  ): Promise<{ issues: VisualIssue[]; overall_health: "healthy" | "issues_found" | "broken" }> {
    const contextPrompt = context ? `\n\nContext about this page: ${context}` : "";

    const response = await this.client.messages.create({
      model,
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: screenshotBase64 },
          },
          {
            type: "text",
            text: `You are a senior QA engineer reviewing this screenshot for visual breakages and UX issues.${contextPrompt}

Scan for problems a human reviewer would flag:
- **Layout**: misaligned elements, overlapping content, inconsistent spacing, broken grids
- **Overflow**: text that's cut off, containers too small, horizontal scroll on content that shouldn't scroll
- **Broken images**: missing image placeholders, broken icons, alt text showing instead of images
- **Missing elements**: empty areas where content should be, missing navigation, blank placeholders
- **Accessibility**: illegible text (contrast), tiny touch targets, missing labels
- **Other**: error messages, loading spinners stuck, placeholder text left in production

Ignore cosmetic preferences. Only flag actual bugs or UX breakages.

Respond with JSON:
{
  "overall_health": "healthy" | "issues_found" | "broken",
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "category": "layout" | "overflow" | "broken_image" | "missing_element" | "accessibility" | "other",
      "description": "specific description of the issue",
      "location": "where on the page (e.g. 'top navigation', 'hero section')"
    }
  ]
}

If the page looks healthy, return an empty issues array with overall_health: "healthy".`
          }
        ]
      }]
    });

    const textBlock = response.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined;
    if (!textBlock) {
      return { issues: [], overall_health: "healthy" };
    }

    try {
      const parsed = extractJson(textBlock.text);
      return {
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        overall_health: parsed.overall_health ?? "healthy",
      };
    } catch {
      return { issues: [], overall_health: "healthy" };
    }
  }
}

function parseAssertionResponse(response: Anthropic.Message): AssertionResult {
  const textBlock = response.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined;
  if (!textBlock) {
    return { pass: false, confidence: 0, reasoning: "No response from LLM" };
  }

  try {
    const parsed = extractJson(textBlock.text);
    return {
      pass: parsed.pass ?? false,
      confidence: parsed.confidence ?? 0,
      reasoning: parsed.reasoning ?? "",
    };
  } catch {
    return { pass: false, confidence: 0, reasoning: "Failed to parse LLM response" };
  }
}

function extractJson(text: string): any {
  // Try fenced JSON block first, then fall back to first JSON object in text
  const fenced = text.match(/```json\n([\s\S]*?)\n```/);
  if (fenced) return JSON.parse(fenced[1]);
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error("No JSON found in response");
}
