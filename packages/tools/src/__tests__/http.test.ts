import { describe, it, expect } from "vitest";
import { HttpTool } from "../http.js";
import type { AxiosResponse } from "axios";

function makeResponse(status: number, data: unknown): AxiosResponse {
  return {
    status,
    data,
    statusText: "OK",
    headers: {},
    config: {} as any,
  };
}

describe("HttpTool", () => {
  const tool = new HttpTool();

  describe("assertStatus", () => {
    it("returns success=true when status matches", () => {
      const result = tool.assertStatus(makeResponse(200, {}), 200);
      expect(result).toEqual({ success: true, actual: 200 });
    });

    it("returns success=false when status differs", () => {
      const result = tool.assertStatus(makeResponse(404, {}), 200);
      expect(result).toEqual({ success: false, actual: 404 });
    });

    it("works with various HTTP status codes", () => {
      expect(tool.assertStatus(makeResponse(201, {}), 201).success).toBe(true);
      expect(tool.assertStatus(makeResponse(500, {}), 200).success).toBe(false);
      expect(tool.assertStatus(makeResponse(301, {}), 301).success).toBe(true);
    });
  });

  describe("validateJson", () => {
    it("returns valid=true for object response", () => {
      const result = tool.validateJson(makeResponse(200, { key: "value" }));
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ key: "value" });
    });

    it("returns valid=true for array response (array is an object)", () => {
      const result = tool.validateJson(makeResponse(200, [1, 2, 3]));
      expect(result.valid).toBe(true);
    });

    it("returns valid=false for string response", () => {
      const result = tool.validateJson(makeResponse(200, "not json"));
      expect(result.valid).toBe(false);
    });

    it("returns valid=false for number response", () => {
      const result = tool.validateJson(makeResponse(200, 42));
      expect(result.valid).toBe(false);
    });

    it("returns valid=true for null response (null is object type)", () => {
      const result = tool.validateJson(makeResponse(200, null));
      expect(result.valid).toBe(true);
    });
  });
});
