import Anthropic from "@anthropic-ai/sdk";
import { Scenario } from "@agentqa/core";
import { HttpTool, AssertionEngine } from "@agentqa/tools";
import { BaseAgent } from "./base-agent.js";

export class APIAgent extends BaseAgent {
  private http: HttpTool;
  private assertions: AssertionEngine;

  constructor(model?: string) {
    super(model);
    this.http = new HttpTool();
    this.assertions = new AssertionEngine();
  }

  getTools(): Anthropic.Tool[] {
    return [
      {
        name: "http_get",
        description: "Make an HTTP GET request. Returns status code, headers, and response body.",
        input_schema: {
          type: "object",
          properties: {
            url: { type: "string", description: "Full URL to request" },
            headers: { type: "object", description: "Optional request headers (e.g. Authorization, Content-Type)" }
          },
          required: ["url"]
        }
      },
      {
        name: "http_post",
        description: "Make an HTTP POST request with a JSON body.",
        input_schema: {
          type: "object",
          properties: {
            url: { type: "string" },
            data: { type: "object", description: "Request body (JSON)" },
            headers: { type: "object" }
          },
          required: ["url", "data"]
        }
      },
      {
        name: "http_put",
        description: "Make an HTTP PUT request with a JSON body.",
        input_schema: {
          type: "object",
          properties: {
            url: { type: "string" },
            data: { type: "object" },
            headers: { type: "object" }
          },
          required: ["url", "data"]
        }
      },
      {
        name: "http_patch",
        description: "Make an HTTP PATCH request with a partial update body.",
        input_schema: {
          type: "object",
          properties: {
            url: { type: "string" },
            data: { type: "object" },
            headers: { type: "object" }
          },
          required: ["url", "data"]
        }
      },
      {
        name: "http_delete",
        description: "Make an HTTP DELETE request.",
        input_schema: {
          type: "object",
          properties: {
            url: { type: "string" },
            headers: { type: "object" }
          },
          required: ["url"]
        }
      },
      {
        name: "assert_response",
        description: "Use AI to semantically evaluate whether an API response satisfies an expectation. Useful for complex response validation that goes beyond simple field checks.",
        input_schema: {
          type: "object",
          properties: {
            response_text: { type: "string", description: "The API response data as text" },
            expectation: { type: "string", description: "What the response should satisfy (natural language)" }
          },
          required: ["response_text", "expectation"]
        }
      }
    ];
  }

  async handleToolCall(name: string, input: Record<string, unknown>): Promise<unknown> {
    const { url, data, headers } = input;

    if (name === "assert_response") {
      return this.assertions.assertText(
        input.response_text as string,
        input.expectation as string
      );
    }

    try {
      let response;
      switch (name) {
        case "http_get":
          response = await this.http.get(url as string, headers as Record<string, string>);
          break;
        case "http_post":
          response = await this.http.post(url as string, data, headers as Record<string, string>);
          break;
        case "http_put":
          response = await this.http.put(url as string, data, headers as Record<string, string>);
          break;
        case "http_patch":
          response = await this.http.patch(url as string, data, headers as Record<string, string>);
          break;
        case "http_delete":
          response = await this.http.delete(url as string, headers as Record<string, string>);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        status: response.status,
        headers: response.headers,
        data: response.data
      };
    } catch (error: any) {
      return {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      };
    }
  }

  buildSystemPrompt(scenario: Scenario): string {
    return `You are an API testing agent that validates HTTP endpoints by making requests and checking responses.

## Your approach
1. **Construct requests** from the scenario steps using the environment base_url and api_url
2. **Make requests** — use the appropriate HTTP method (GET, POST, PUT, PATCH, DELETE)
3. **Chain requests** when needed — use data from one response to build subsequent requests (e.g. create then get)
4. **Validate responses** — check status codes, response bodies, headers, and error formats
5. **Evaluate expectations** — compare actual vs expected behavior

## Request construction
- Build full URLs using the base_url or api_url from the environment
- Set Content-Type: application/json for POST/PUT/PATCH requests
- Include Authorization headers when the scenario mentions authentication
- Use realistic test data that matches the scenario description

## Response validation strategies
- Check status codes first (200, 201, 400, 404, etc.)
- Verify response body structure (fields present, correct types)
- Check error responses have proper error messages
- For create endpoints: verify the created resource is returned
- For auth endpoints: verify tokens/sessions are returned

## When to use assert_response
- Use assert_response for complex semantic checks (e.g. "response contains a valid email format")
- For simple checks (status code, field existence), evaluate directly

## Evidence and confidence
- **confidence 0.9-1.0**: Status code matches, response body has expected fields/values
- **confidence 0.7-0.8**: Status code matches but response body has minor differences
- **confidence 0.5-0.6**: Ambiguous response, partially matches
- Always include evidence: actual status code, relevant response fields, error messages

## Output format
After completing all steps, return your result as a JSON code block:
\`\`\`json
{
  "status": "pass" | "fail" | "error",
  "expectations": [
    { "text": "the expectation text", "status": "pass" | "fail", "confidence": 0.95, "evidence": "HTTP 200, body: {id: 1, ...}", "reasoning": "why this passes or fails" }
  ],
  "summary": "brief overall summary"
}
\`\`\``;
  }
}
