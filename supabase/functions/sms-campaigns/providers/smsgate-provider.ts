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
    this.baseUrl =
      credentials.baseUrl || "https://api.sms-gate.app/3rdparty/v1/messages";
    this.username = credentials.username;
    this.password = credentials.password;
  }

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    const normalizedBaseUrl = this.baseUrl.replace(/\/+$/, "");
    const url = normalizedBaseUrl.endsWith("/3rdparty/v1/messages")
      ? normalizedBaseUrl
      : `${normalizedBaseUrl}/3rdparty/v1/messages`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${btoa(`${this.username}:${this.password}`)}`,
        },
        body: JSON.stringify({
          textMessage: { text: params.body },
          phoneNumbers: [params.to],
        }),
        signal: AbortSignal.timeout(15000),
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("timeout") || errorMessage.includes("abort")) {
        return {
          success: false,
          error:
            "Gateway timeout - The SMS gateway is not responding. Keep the gateway app active on your phone during the sending process.",
        };
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
