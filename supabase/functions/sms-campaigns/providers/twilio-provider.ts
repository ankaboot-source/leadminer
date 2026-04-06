import type { SendSmsParams, SendSmsResult, SmsProvider } from "./types.ts";

function readRequiredEnv(name: string): string {
  const raw = (Deno.env.get(name) || "").trim();
  const normalized = raw.toLowerCase();
  if (!raw || normalized === "undefined" || normalized === "null") {
    return "";
  }
  return raw;
}

const TWILIO_ACCOUNT_SID = readRequiredEnv("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = readRequiredEnv("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = readRequiredEnv("TWILIO_FROM_NUMBER");

export class TwilioProvider implements SmsProvider {
  name = "twilio";
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      throw new Error("Twilio credentials not configured");
    }
    this.accountSid = TWILIO_ACCOUNT_SID;
    this.authToken = TWILIO_AUTH_TOKEN;
    this.fromNumber = TWILIO_FROM_NUMBER;
  }

  static isConfigured(): boolean {
    return Boolean(
      TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER,
    );
  }

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const auth = btoa(`${this.accountSid}:${this.authToken}`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: params.to,
          From: params.from || this.fromNumber,
          Body: params.body,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || "Twilio error",
        };
      }

      return {
        success: true,
        messageId: data.sid,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
