import type { SmsProvider, SendSmsParams, SendSmsResult } from "./types.ts";

export interface SimpleSmsGatewayCredentials {
  baseUrl: string;
}

export class SimpleSmsGatewayProvider implements SmsProvider {
  name = "simple-sms-gateway";
  private baseUrl: string;

  constructor(credentials: SimpleSmsGatewayCredentials) {
    if (!credentials.baseUrl) {
      throw new Error("simple-sms-gateway base URL is required");
    }

    this.baseUrl = credentials.baseUrl;
  }

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    const url = this.baseUrl;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: params.to,
          message: params.body,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || "simple-sms-gateway error",
        };
      }

      return {
        success: true,
        messageId: data.id || data.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
