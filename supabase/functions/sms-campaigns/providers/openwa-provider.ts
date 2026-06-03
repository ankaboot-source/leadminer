import type { SmsProvider, SendSmsParams, SendSmsResult } from "./types.ts";
import { OpenWAClient } from "../../_shared/openwa-client.ts";

export interface OpenWACredentials {
  baseUrl: string;
  apiKey?: string;
  sessionId: string;
}

export class OpenWAProvider implements SmsProvider {
  name = "openwa";
  private client: OpenWAClient;
  private sessionId: string;

  constructor(credentials: OpenWACredentials) {
    if (!credentials.sessionId) {
      throw new Error("OpenWA session ID not configured");
    }
    this.client = new OpenWAClient(credentials.baseUrl, credentials.apiKey);
    this.sessionId = credentials.sessionId;
  }

  static isConfigured(): boolean {
    return Boolean(
      Deno.env.get("OPENWA_BASE_URL") && Deno.env.get("OPENWA_API_KEY"),
    );
  }

  private toChatId(phone: string): string {
    const cleaned = phone.replace(/[^0-9]/g, "");
    return `${cleaned}@c.us`;
  }

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    try {
      const chatId = this.toChatId(params.to);
      const result = await this.client.sendText(
        this.sessionId,
        chatId,
        params.body,
      );
      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("timeout") || errorMessage.includes("abort")) {
        return {
          success: false,
          error: "OpenWA timeout - WhatsApp session is not responding.",
        };
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
