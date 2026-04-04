export declare class AssertionEngine {
    private client;
    constructor();
    assertText(text: string, expectation: string, model?: string): Promise<{
        pass: boolean;
        confidence: number;
        reasoning: string;
    }>;
    assertScreenshot(screenshotBase64: string, expectation: string, model?: string): Promise<{
        pass: boolean;
        confidence: number;
        reasoning: string;
    }>;
}
//# sourceMappingURL=assertions.d.ts.map