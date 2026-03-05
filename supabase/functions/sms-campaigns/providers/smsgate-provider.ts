import type { SmsProvider, SendSmsParams, SendSmsResult } from "./types.ts";

export interface SmsGateCredentials {
  baseUrl: string;
  username: string;
  password: string;
}

export class SmsGateProvider implements SmsProvider {
  name = "smsgate";
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor(credentials: SmsGateCredentials) {
    if (!credentials.username || !credentials.password) {
      throw new Error("SMSGate credentials not configured");
    }
    this.baseUrl = credentials.baseUrl || "https://api.sms-gate.app";
    this.username = credentials.username;
    this.password = credentials.password;
  }

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    const url = `${this.baseUrl}/3rdparty/v1/messages`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${btoa(`${this.username}:${this.password}`)}`,
        },
        body: JSON.stringify({
          phoneNumber: params.to,
          sender: params.from,
          message: params.body,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || "SMSGate error",
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
