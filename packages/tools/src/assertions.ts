import Anthropic from "@anthropic-ai/sdk";

export class AssertionEngine {
  private client: Anthropic;
  
  constructor() {
    this.client = new Anthropic();
  }
  
  async assertText(
    text: string,
    expectation: string,
    model = "claude-sonnet-4-20250514"
  ): Promise<{ pass: boolean; confidence: number; reasoning: string }> {
    const response = await this.client.messages.create({
      model,
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `Given this text content:\n\n${text}\n\nDoes it satisfy this expectation: "${expectation}"?\n\nRespond with JSON: { "pass": true/false, "confidence": 0.0-1.0, "reasoning": "..." }`
      }]
    });
    
    const textBlock = response.content.find(b => b.type === "text") as Anthropic.TextBlock;
    if (!textBlock) {
      return { pass: false, confidence: 0, reasoning: "No response from LLM" };
    }
    
    try {
      const parsed = JSON.parse(textBlock.text);
      return {
        pass: parsed.pass ?? false,
        confidence: parsed.confidence ?? 0,
        reasoning: parsed.reasoning ?? "",
      };
    } catch {
      return { pass: false, confidence: 0, reasoning: "Failed to parse LLM response" };
    }
  }
  
  async assertScreenshot(
    screenshotBase64: string,
    expectation: string,
    model = "claude-sonnet-4-20250514"
  ): Promise<{ pass: boolean; confidence: number; reasoning: string }> {
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
    
    const textBlock = response.content.find(b => b.type === "text") as Anthropic.TextBlock;
    if (!textBlock) {
      return { pass: false, confidence: 0, reasoning: "No response from LLM" };
    }
    
    try {
      const parsed = JSON.parse(textBlock.text);
      return {
        pass: parsed.pass ?? false,
        confidence: parsed.confidence ?? 0,
        reasoning: parsed.reasoning ?? "",
      };
    } catch {
      return { pass: false, confidence: 0, reasoning: "Failed to parse LLM response" };
    }
  }
}
