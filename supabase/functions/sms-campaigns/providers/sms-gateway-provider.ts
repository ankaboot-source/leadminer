import type { SendSmsParams, SendSmsResult, SmsProvider } from "./types.ts";

// Provider for the "SMS Gateway" app
// (https://apps.apple.com/us/app/sms-gateway/id6767250233).
//
// Distinct from the Android "Simple SMS Gateway" app: the body field
// names differ ({ to, message, id } vs { phone, message }).
// Response shape: { id, status: "sent" | "failed", error } on 2xx,
// { error } on 4xx/5xx.

export const SMS_GATEWAY_PROVIDER_NAME = "sms-gateway";
export const SMS_GATEWAY_DOWNLOAD_URL =
  "https://apps.apple.com/us/app/sms-gateway/id6767250233";

export interface SmsGatewayCredentials {
  baseUrl: string;
}

export class SmsGatewayProvider implements SmsProvider {
  name = SMS_GATEWAY_PROVIDER_NAME;
  private baseUrl: string;

  constructor(credentials: SmsGatewayCredentials) {
    if (!credentials.baseUrl) {
      throw new Error("sms-gateway base URL is required");
    }
    this.baseUrl = credentials.baseUrl;
  }

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    const url = joinUrl(this.baseUrl, "/send-sms");

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: params.to,
          message: params.body,
          id: crypto.randomUUID(),
        }),
        signal: AbortSignal.timeout(15000),
      });

      const data = await response
        .json()
        .catch(() => ({}) as Record<string, unknown>);

      if (!response.ok) {
        return {
          success: false,
          error: errorMessage(data) || `sms-gateway HTTP ${response.status}`,
        };
      }

      if (data.status === "failed") {
        return {
          success: false,
          error: errorMessage(data) || "sms-gateway reported failure",
        };
      }

      return {
        success: true,
        messageId: typeof data.id === "string" ? data.id : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("timeout") || errorMessage.includes("abort")) {
        return {
          success: false,
          error:
            "Gateway timeout - the sms-gateway app is not responding. Keep the app active on your phone during the sending process.",
        };
      }
      return { success: false, error: errorMessage };
    }
  }
}

function errorMessage(data: Record<string, unknown>): string | null {
  if (typeof data.error === "string") return data.error;
  if (typeof data.message === "string") return data.message;
  return null;
}

function joinUrl(base: string, path: string): string {
  if (!path) return base;
  if (base.endsWith("/") && path.startsWith("/")) return base + path.slice(1);
  if (!base.endsWith("/") && !path.startsWith("/")) return base + "/" + path;
  return base + path;
}
