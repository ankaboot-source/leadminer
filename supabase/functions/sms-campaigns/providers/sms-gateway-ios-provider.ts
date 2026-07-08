import type { SendSmsParams, SendSmsResult, SmsProvider } from "./types.ts";

/**
 * Provider for the "SMS Gateway" iOS app
 * (https://apps.apple.com/us/app/sms-gateway/id6767250233).
 *
 * The iOS app exposes a `POST /send-sms` endpoint with a body shape
 * different from the Android "Simple SMS Gateway" app:
 *
 *   Android: { phone, message }
 *   iOS:     { to, message, id }
 *
 * Response shape:
 *   2xx: { id: string, status: "sent" | "failed", error: string | null }
 *   4xx/5xx: { error: string }
 *
 * Keep this provider separate from `SimpleSmsGatewayProvider` so the
 * two apps can evolve independently and the field-name contract is
 * explicit in each file.
 */

export const SMS_GATEWAY_IOS_PROVIDER_NAME = "sms-gateway-ios";

/** App Store id, useful for matching the gateway's `appId` config. */
export const SMS_GATEWAY_IOS_APP_ID = "ios-sms-gateway";

/** Stable id we expose via the `SmsProvider.name` field. */
export const SMS_GATEWAY_IOS_DOWNLOAD_URL =
  "https://apps.apple.com/us/app/sms-gateway/id6767250233";

export interface SmsGatewayIosCredentials {
  baseUrl: string;
}

export class SmsGatewayIosProvider implements SmsProvider {
  name = SMS_GATEWAY_IOS_PROVIDER_NAME;
  private baseUrl: string;

  constructor(credentials: SmsGatewayIosCredentials) {
    if (!credentials.baseUrl) {
      throw new Error("SMS Gateway (iOS) base URL is required");
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
        const err =
          typeof data.error === "string"
            ? data.error
            : typeof data.message === "string"
              ? data.message
              : null;
        return {
          success: false,
          error: err || `SMS Gateway (iOS) HTTP ${response.status}`,
        };
      }

      // The iOS app returns `{ id, status: "sent" | "failed", error }`.
      // If `status === "failed"`, treat the send as failed even though
      // the HTTP status was 2xx.
      if (data.status === "failed") {
        const err = typeof data.error === "string" ? data.error : null;
        return {
          success: false,
          error: err || "SMS Gateway (iOS) reported failure",
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
            "Gateway timeout - The SMS Gateway (iOS) app is not responding. Keep the app active on your phone during the sending process.",
        };
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

function joinUrl(base: string, path: string): string {
  if (!path) return base;
  if (base.endsWith("/") && path.startsWith("/")) {
    return base + path.slice(1);
  }
  if (!base.endsWith("/") && !path.startsWith("/")) {
    return base + "/" + path;
  }
  return base + path;
}
