/**
 * Reachability probes for self-hosted SMS gateways.
 *
 * Both the Android "Simple SMS Gateway" app and the iOS "SMS Gateway"
 * app expose a `POST /send-sms` endpoint with slightly different body
 * shapes. Before saving a user-supplied base URL we want to make sure the
 * endpoint actually answers (instead of silently mis-routing the user's
 * next campaign).
 *
 * `probeGatewayReachability` is used by `sms-fleet` and `sms-campaigns`
 * before persisting a new gateway row. It is intentionally cheap: a
 * throwaway test phone number from a non-routable range is used so the
 * gateway accepts the call but never delivers an SMS to a real
 * subscriber.
 */

export type GatewayProvider = "simple-sms-gateway" | "sms-gateway";

export interface ProbeResult {
  success: boolean;
  message: string;
}

export interface ProbeOptions {
  provider?: GatewayProvider;
}

/**
 * Build a non-routable placeholder phone number. The actual value is
 * irrelevant — we never expect a real carrier to deliver it. The shape
 * just has to be a valid E.164 string so neither gateway rejects the
 * request outright.
 */
const PROBE_PHONE = "+15555550100";
const PROBE_MESSAGE = "Reachability test";

/**
 * Lightweight reachability probe shared by `sms-fleet` and
 * `sms-campaigns`. POSTs a single test SMS to `<baseUrl>/send-sms` and
 * treats any 2xx, 3xx, or 4xx response as proof the gateway is
 * reachable. 5xx, network errors, and timeouts are real failures.
 *
 * The request body shape depends on the provider:
 * - `simple-sms-gateway` (Android) uses `{ phone, message }`.
 * - `sms-gateway` (iOS) uses `{ to, message, id }` with an opaque
 *   UUID `id` (per the SMS Gateway wire contract).
 */
export async function probeGatewayReachability(
  baseUrl: string,
  options: ProbeOptions = {},
): Promise<ProbeResult> {
  const url = joinUrl(baseUrl, "/send-sms");
  const body = options.provider === "sms-gateway"
    ? { to: PROBE_PHONE, message: PROBE_MESSAGE, id: crypto.randomUUID() }
    : { phone: PROBE_PHONE, message: PROBE_MESSAGE };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (response.status >= 500) {
      return {
        success: false,
        message: `Gateway returned HTTP ${response.status}`,
      };
    }
    return { success: true, message: "Gateway is reachable" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: message || "Network error reaching gateway",
    };
  }
}

/**
 * Extract the base URL the self-hosted SMS gateway providers need from
 * the caller-supplied config. The frontend currently uses the
 * `simpleSmsGatewayBaseUrl` key, but the gateway row may also use
 * `baseUrl` for SMSGate and other providers. We accept either for
 * safety.
 */
export function extractSimpleSmsGatewayBaseUrl(
  config: Record<string, unknown>,
): string | null {
  const candidates: unknown[] = [
    config.simpleSmsGatewayBaseUrl,
    config.baseUrl,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

/**
 * Join a base URL with a path, collapsing any duplicate `/` between the
 * two. Returns `base` unchanged when `path` is empty.
 */
export function joinUrl(base: string, path: string): string {
  if (!path) return base;
  if (base.endsWith("/") && path.startsWith("/")) return base + path.slice(1);
  if (!base.endsWith("/") && !path.startsWith("/")) return base + "/" + path;
  return base + path;
}
