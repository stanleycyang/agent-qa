import { AxiosResponse } from "axios";
export declare class HttpTool {
    get(url: string, headers?: Record<string, string>): Promise<AxiosResponse>;
    post(url: string, data: unknown, headers?: Record<string, string>): Promise<AxiosResponse>;
    put(url: string, data: unknown, headers?: Record<string, string>): Promise<AxiosResponse>;
    patch(url: string, data: unknown, headers?: Record<string, string>): Promise<AxiosResponse>;
    delete(url: string, headers?: Record<string, string>): Promise<AxiosResponse>;
    assertStatus(response: AxiosResponse, expected: number): {
        success: boolean;
        actual: number;
    };
    validateJson(response: AxiosResponse, schema?: Record<string, unknown>): {
        valid: boolean;
        data: unknown;
    };
}
//# sourceMappingURL=http.d.ts.map