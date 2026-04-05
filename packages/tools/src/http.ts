import axios, { AxiosResponse } from "axios";

export class HttpTool {
  async get(url: string, headers?: Record<string, string>): Promise<AxiosResponse> {
    return axios.get(url, { headers });
  }

  async post(url: string, data: unknown, headers?: Record<string, string>): Promise<AxiosResponse> {
    return axios.post(url, data, { headers });
  }

  async put(url: string, data: unknown, headers?: Record<string, string>): Promise<AxiosResponse> {
    return axios.put(url, data, { headers });
  }

  async patch(url: string, data: unknown, headers?: Record<string, string>): Promise<AxiosResponse> {
    return axios.patch(url, data, { headers });
  }

  async delete(url: string, headers?: Record<string, string>): Promise<AxiosResponse> {
    return axios.delete(url, { headers });
  }

  assertStatus(response: AxiosResponse, expected: number): { success: boolean; actual: number } {
    return {
      success: response.status === expected,
      actual: response.status,
    };
  }

  validateJson(response: AxiosResponse, schema?: Record<string, unknown>): { valid: boolean; data: unknown } {
    const isJson = typeof response.data === "object";
    return {
      valid: isJson,
      data: response.data,
    };
  }
}
