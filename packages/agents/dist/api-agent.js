import { HttpTool } from "@agentqa/tools";
import { BaseAgent } from "./base-agent.js";
export class APIAgent extends BaseAgent {
    http;
    constructor(model) {
        super(model);
        this.http = new HttpTool();
    }
    getTools() {
        return [
            {
                name: "http_get",
                description: "Make an HTTP GET request",
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
                name: "http_post",
                description: "Make an HTTP POST request",
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
                name: "http_put",
                description: "Make an HTTP PUT request",
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
                description: "Make an HTTP DELETE request",
                input_schema: {
                    type: "object",
                    properties: {
                        url: { type: "string" },
                        headers: { type: "object" }
                    },
                    required: ["url"]
                }
            }
        ];
    }
    async handleToolCall(name, input) {
        const { url, data, headers } = input;
        try {
            let response;
            switch (name) {
                case "http_get":
                    response = await this.http.get(url, headers);
                    break;
                case "http_post":
                    response = await this.http.post(url, data, headers);
                    break;
                case "http_put":
                    response = await this.http.put(url, data, headers);
                    break;
                case "http_delete":
                    response = await this.http.delete(url, headers);
                    break;
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
            return {
                status: response.status,
                headers: response.headers,
                data: response.data
            };
        }
        catch (error) {
            return {
                error: error.message,
                status: error.response?.status,
                data: error.response?.data
            };
        }
    }
    buildSystemPrompt(scenario) {
        return `You are an API testing agent. Use HTTP tools to test API endpoints.

Make requests, validate responses, check status codes and response bodies.

After completing all steps, evaluate each expectation and return a JSON result.`;
    }
}
//# sourceMappingURL=api-agent.js.map