export interface MockConfig {
  successRate: number; // 0.0-1.0, default 1.0
  delayMs: number; // artificial delay, default 0
  failMessage: string; // error message when failing, default "Mock gateway error"
  failStatusCode: number; // HTTP status when failing, default 500
  sequentialId: boolean; // whether to generate sequential IDs, default true
  idPrefix: string; // prefix for message IDs, default "mock_"
}

export const defaultConfig: MockConfig = {
  successRate: 1.0,
  delayMs: 0,
  failMessage: "Mock gateway error",
  failStatusCode: 500,
  sequentialId: true,
  idPrefix: "mock_",
};