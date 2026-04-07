export type EnvironmentType = "web" | "api" | "logic" | "a11y" | "security";
export interface SpecTrigger {
    paths?: string[];
    labels?: string[];
}
export interface SpecEnvironment {
    type: EnvironmentType;
    base_url?: string;
    setup?: Array<{
        seed: string;
    }>;
}
export interface ScenarioStep {
    steps?: string[];
    review?: string[];
    expect: string[];
    on_failure?: "screenshot" | "trace" | "both";
}
export interface Scenario extends ScenarioStep {
    name: string;
}
export interface AgentQASpec {
    name: string;
    description?: string;
    trigger: SpecTrigger;
    environment: SpecEnvironment;
    scenarios: Scenario[];
}
export interface ExpectationResult {
    text: string;
    status: "pass" | "fail" | "skip";
    confidence?: number;
    evidence?: string;
    reasoning?: string;
}
export interface ScenarioResult {
    scenario: string;
    status: "pass" | "fail" | "error";
    expectations: ExpectationResult[];
    duration_ms: number;
    screenshots?: string[];
    error?: string;
    trace?: ToolCall[];
    viewport?: string;
    browser?: string;
    video_path?: string;
    network_path?: string;
    flaky?: {
        rate: number;
        runs: number;
    };
    perf_regression?: {
        baseline_ms: number;
        current_ms: number;
        ratio: number;
    };
    healed_selectors?: Array<{
        original: string;
        healed: string;
        reasoning: string;
    }>;
}
export interface SpecResult {
    spec: string;
    scenarios: ScenarioResult[];
    status: "pass" | "fail" | "error";
    duration_ms: number;
}
export interface ExecutionPlan {
    specs: Array<{
        spec: AgentQASpec;
        specPath: string;
        scenarios: Scenario[];
    }>;
    environment: {
        base_url?: string;
        api_url?: string;
    };
}
export interface ToolCall {
    tool: string;
    input: Record<string, unknown>;
    output: unknown;
    timestamp: number;
}
export interface ViewportConfig {
    name: string;
    width: number;
    height: number;
}
export type BrowserType = "chromium" | "firefox" | "webkit";
export interface AgentQAConfig {
    version: number;
    model?: {
        provider?: string;
        model?: string;
        vision_model?: string;
    };
    execution?: {
        concurrency?: number;
        timeout_per_scenario?: number;
        retries?: number;
        screenshot_on_failure?: boolean;
        viewports?: ViewportConfig[];
        browsers?: BrowserType[];
        flaky_threshold?: number;
        perf_regression_threshold?: number;
        record_video_on_failure?: boolean;
    };
    environment?: {
        preview_url?: string;
        api_url?: string;
        env_file?: string;
    };
    reporting?: {
        github_comment?: boolean;
        github_status?: boolean;
        verbose?: boolean;
        artifact_screenshots?: boolean;
    };
    integrations?: {
        figma_token?: string;
        sentry_token?: string;
        sentry_org?: string;
        sentry_project?: string;
        linear_token?: string;
        jira_token?: string;
        jira_host?: string;
        jira_email?: string;
    };
}
//# sourceMappingURL=types.d.ts.map