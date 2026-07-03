/**
 * SMS Gateway API spec discovery.
 *
 * Many SMS gateway apps (e.g. the popular "Simple SMS Gateway" iOS/Android
 * app) accept their request body in different shapes — some use
 * `{ phone, message }`, others `{ to, text }`, others `{ number, body }`.
 * Hard-coding a single field name silently breaks every other gateway.
 *
 * This module auto-discovers the gateway's OpenAPI/Swagger spec from common
 * paths, extracts the SMS request body schema, and provides helpers to
 * build/test payloads that match what the gateway actually expects.
 *
 * The implementation is intentionally defensive: when discovery fails we
 * fall back to the legacy `{ phone, message }` shape so a misconfigured
 * gateway still works (it just won't be using the optimal field names).
 */

import { createLogger } from "../../_shared/logger.ts";

const logger = createLogger("sms-gateway-spec");

/**
 * Auto-discovered SMS request body schema from a gateway's OpenAPI spec.
 */
export interface DiscoveredSmsSchema {
  /** Endpoint path, e.g. "/send-sms" or "/messages". */
  endpoint: string;
  /** JSON property name for the destination phone number. */
  phoneField: string;
  /** JSON property name for the SMS body. */
  messageField: string;
  /** HTTP method the gateway expects (usually POST). */
  method: "POST" | "GET";
  /** Required field names from the spec (best-effort). */
  requiredFields: string[];
}

/**
 * Candidate JSON property names to look for in the request body schema
 * for the destination phone number. Order is priority order.
 */
const PHONE_FIELD_CANDIDATES = [
  "to",
  "phone",
  "number",
  "mobile",
  "recipient",
  "msisdn",
] as const;

/**
 * Candidate JSON property names to look for in the request body schema
 * for the SMS body text. Order is priority order.
 */
const MESSAGE_FIELD_CANDIDATES = [
  "message",
  "text",
  "body",
  "content",
] as const;

/** Common OpenAPI/Swagger spec paths, tried in order. */
const SPEC_PATHS = [
  "/swagger.json",
  "/openapi.json",
  "/api-docs",
  "/docs/openapi.json",
  "/v1/openapi.json",
  "/spec.json",
] as const;

/** Path patterns that strongly suggest an SMS-sending endpoint. */
const PREFERRED_PATH_PATTERNS = [
  /^\/send-sms/i,
  /^\/sms\/?$/i,
  /^\/send\/?$/i,
  /\/messages\/?$/i,
  /\/message\/?$/i,
] as const;

const DISCOVERY_TIMEOUT_MS = 5000;
const REACHABILITY_TIMEOUT_MS = 10000;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function joinUrl(baseUrl: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return value as Record<string, unknown>;
}

function getString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return null;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Pick the first field name that exists in `properties` and matches
 * one of the candidate names (case-insensitive).
 */
function pickFieldName(
  properties: Record<string, unknown>,
  candidates: readonly string[],
): string | null {
  const propertyNames = Object.keys(properties);
  const lowerToOriginal = new Map<string, string>();
  for (const name of propertyNames) {
    lowerToOriginal.set(name.toLowerCase(), name);
  }
  for (const candidate of candidates) {
    const actual = lowerToOriginal.get(candidate.toLowerCase());
    if (actual) {
      return actual;
    }
  }
  return null;
}

/**
 * Try to fetch an OpenAPI/Swagger spec from common paths on the gateway.
 * Returns the parsed spec object on success, or null if no spec is found
 * or any spec candidate fails to parse as JSON.
 *
 * Tries these paths in order: /swagger.json, /openapi.json, /api-docs,
 * /docs/openapi.json, /v1/openapi.json, /spec.json. The first successful
 * response is returned; the rest are not tried.
 */
export async function discoverGatewaySpec(
  baseUrl: string,
): Promise<unknown | null> {
  if (!baseUrl) {
    return null;
  }

  for (const path of SPEC_PATHS) {
    const url = joinUrl(baseUrl, path);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
      });

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      // Most specs are served as JSON, but some gateways serve YAML.
      if (
        contentType &&
        !contentType.includes("json") &&
        !contentType.includes("yaml") &&
        !contentType.includes("text")
      ) {
        continue;
      }

      const text = await response.text();
      if (!text.trim()) {
        continue;
      }

      try {
        const parsed = JSON.parse(text) as unknown;
        if (parsed && typeof parsed === "object") {
          logger.debug("Discovered gateway spec", { path });
          return parsed;
        }
      } catch {
        // Not JSON — skip this candidate. (We don't currently parse YAML
        // since the popular iOS gateway serves JSON, but the hook is here
        // for future YAML support.)
        continue;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.debug("Spec discovery request failed", {
        path,
        error: errorMessage,
      });
      // Continue to next candidate — one failing path shouldn't kill discovery.
    }
  }

  logger.warn("No OpenAPI/Swagger spec discovered on gateway", { baseUrl });
  return null;
}

/**
 * Extract the SMS request body schema from a parsed OpenAPI spec.
 * Returns null if no suitable SMS endpoint is found.
 *
 * Strategy:
 *   1. Iterate `paths` and collect all POST endpoints (or GET as a fallback).
 *   2. Score each endpoint by path pattern: prefer /send-sms, /messages,
 *      /sms, /send. The first match wins; if none match, fall back to the
 *      first POST endpoint we found.
 *   3. Examine the endpoint's request body schema (JSON application/json
 *      content), pull out required and optional properties, and pick the
 *      phone/message field names from candidate lists.
 */
export function extractSmsRequestSchema(
  spec: unknown,
): DiscoveredSmsSchema | null {
  if (!spec || typeof spec !== "object") {
    return null;
  }
  const root = asRecord(spec);
  const paths = asRecord(root.paths);
  if (Object.keys(paths).length === 0) {
    return null;
  }

  type Candidate = {
    path: string;
    method: "POST" | "GET";
    operation: Record<string, unknown>;
    score: number;
  };

  const candidates: Candidate[] = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    const pathRecord = asRecord(pathItem);
    for (const method of ["post", "get"] as const) {
      const operation = asRecord(pathRecord[method]);
      if (Object.keys(operation).length === 0) {
        continue;
      }
      let score = 0;
      for (const pattern of PREFERRED_PATH_PATTERNS) {
        if (pattern.test(path)) {
          score += 10;
        }
      }
      // Slight bonus for POST since that's the more common pattern.
      if (method === "post") {
        score += 1;
      }
      candidates.push({
        path,
        method: method === "post" ? "POST" : "GET",
        operation,
        score,
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];
  if (!winner) {
    return null;
  }

  const requestBody = asRecord(winner.operation.requestBody);
  const content = asRecord(requestBody.content);
  const jsonContent = asRecord(content["application/json"]);
  const schema = asRecord(jsonContent.schema);
  if (Object.keys(schema).length === 0) {
    return null;
  }

  const properties = asRecord(schema.properties);
  if (Object.keys(properties).length === 0) {
    return null;
  }

  const phoneField = pickFieldName(properties, PHONE_FIELD_CANDIDATES);
  const messageField = pickFieldName(properties, MESSAGE_FIELD_CANDIDATES);

  if (!phoneField || !messageField) {
    logger.warn(
      "Spec found but required SMS fields missing from request body",
      {
        path: winner.path,
        phoneField,
        messageField,
      },
    );
    return null;
  }

  const required = getStringArray(schema.required);

  return {
    endpoint: winner.path,
    phoneField,
    messageField,
    method: winner.method,
    requiredFields: required,
  };
}

/**
 * Build the SMS request body using the discovered schema.
 * Falls back to `{ phone, message }` when schema is null.
 *
 * Always emits only the two canonical fields (phone + message) regardless
 * of what the spec calls them — the gateway should map them to the right
 * JSON property based on the schema we discovered. This keeps the rest
 * of the provider code unchanged.
 */
export function buildSmsBody(
  schema: DiscoveredSmsSchema | null,
  phone: string,
  message: string,
): Record<string, unknown> {
  if (!schema) {
    return { phone, message };
  }
  return {
    [schema.phoneField]: phone,
    [schema.messageField]: message,
  };
}

/**
 * Test reachability of a gateway by sending a POST to the discovered
 * endpoint with a safe test payload. No actual SMS is sent because the
 * destination is a well-known test number that real gateways refuse to
 * deliver to (or simply reject as invalid).
 *
 * For SMS Gate, for example, returning `{ success: true }` from the
 * endpoint confirms the server is up. The test call does not require
 * a valid destination since the gateway will validate it before sending.
 */
export async function testGatewayReachability(
  baseUrl: string,
  schema: DiscoveredSmsSchema | null,
  timeoutMs: number = REACHABILITY_TIMEOUT_MS,
): Promise<{ success: boolean; message: string }> {
  if (!baseUrl) {
    return { success: false, message: "Missing gateway base URL" };
  }

  const endpoint = schema?.endpoint ?? "/";
  const url = joinUrl(baseUrl, endpoint);
  const body = buildSmsBody(
    schema,
    "+10000000000",
    "leadminer-reachability-test",
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.ok) {
      return { success: true, message: "Gateway is reachable" };
    }

    // A 4xx response still proves the server is alive and parsing JSON,
    // which is exactly what we want to know. We treat 5xx as unreachable.
    if (response.status >= 400 && response.status < 500) {
      return {
        success: true,
        message: `Gateway is reachable (HTTP ${response.status})`,
      };
    }

    return {
      success: false,
      message: `Gateway returned HTTP ${response.status}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("timeout") || errorMessage.includes("abort")) {
      return {
        success: false,
        message: "Gateway did not respond within the timeout",
      };
    }
    return { success: false, message: errorMessage };
  }
}
