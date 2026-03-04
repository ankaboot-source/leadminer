import type { SmsProvider, SendSmsParams, SendSmsResult } from "./types.ts";

const SMSGATE_BASE_URL = Deno.env.get("SMSGATE_BASE_URL") || "https://api.sms-gate.app";
const SMSGATE_USERNAME = Deno.env.get("SMSGATE_USERNAME") || "";
const SMSGATE_PASSWORD = Deno.env.get("SMSGATE_PASSWORD") || "";

export class SmsGateProvider implements SmsProvider {
  name = "smsgate";
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor() {
    if (!SMSGATE_USERNAME || !SMSGATE_PASSWORD) {
      throw new Error("SMSGate credentials not configured");
    }
    this.baseUrl = SMSGATE_BASE_URL;
    this.username = SMSGATE_USERNAME;
    this.password = SMSGATE_PASSWORD;
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