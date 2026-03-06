import type { SmsProvider, SendSmsParams, SendSmsResult } from "./types.ts";

export interface SimpleSmsGatewayCredentials {
  baseUrl: string;
  username: string;
  password: string;
}

export class SimpleSmsGatewayProvider implements SmsProvider {
  name = "simple-sms-gateway";
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor(credentials: SimpleSmsGatewayCredentials) {
    if (!credentials.username || !credentials.password) {
      throw new Error("simple-sms-gateway credentials not configured");
    }

    this.baseUrl = credentials.baseUrl || "https://api.simple-sms-gateway.com";
    this.username = credentials.username;
    this.password = credentials.password;
  }

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    const url = `${this.baseUrl}/messages`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${btoa(`${this.username}:${this.password}`)}`,
        },
        body: JSON.stringify({
          to: params.to,
          from: params.from,
          message: params.body,
        }),
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
