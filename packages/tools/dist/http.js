import axios from "axios";
export class HttpTool {
    async get(url, headers) {
        return axios.get(url, { headers });
    }
    async post(url, data, headers) {
        return axios.post(url, data, { headers });
    }
    async put(url, data, headers) {
        return axios.put(url, data, { headers });
    }
    async delete(url, headers) {
        return axios.delete(url, { headers });
    }
    assertStatus(response, expected) {
        return {
            success: response.status === expected,
            actual: response.status,
        };
    }
    validateJson(response, schema) {
        // Basic validation - could be extended with JSON Schema validator
        const isJson = typeof response.data === "object";
        return {
            valid: isJson,
            data: response.data,
        };
    }
}
//# sourceMappingURL=http.js.map