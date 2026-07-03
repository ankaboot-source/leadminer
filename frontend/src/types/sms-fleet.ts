export type SmsGatewayProvider = 'smsgate' | 'simple-sms-gateway' | 'twilio';

/**
 * Auto-discovered SMS request body schema from a gateway's OpenAPI spec.
 * Mirrors the `DiscoveredSmsSchema` shape returned by the
 * `sms-campaigns/utils/gateway-spec.ts` discovery helper and stored
 * under `config.bodySchema` in the `sms_fleet_gateways` table.
 */
export interface DiscoveredSmsSchema {
  /** Endpoint path, e.g. "/send-sms" or "/messages". */
  endpoint: string;
  /** JSON property name for the destination phone number. */
  phoneField: string;
  /** JSON property name for the SMS body text. */
  messageField: string;
  /** HTTP method the gateway expects (usually POST). */
  method: 'POST' | 'GET';
  /** Required field names from the spec (best-effort). */
  requiredFields: string[];
}

/**
 * Optional manual overrides for the SMS request body shape. When set,
 * the backend merges these on top of the discovered schema (if any).
 */
export interface SmsGatewaySchemaOverrides {
  endpoint?: string;
  phoneField?: string;
  messageField?: string;
}

export interface SmsFleetGateway {
  id: string;
  user_id: string;
  name: string;
  provider: SmsGatewayProvider;
  config: SmsGatewayConfig;
  is_active: boolean;
  daily_limit: number;
  monthly_limit: number;
  sent_today: number;
  sent_this_month: number;
  last_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface SmsGatewayConfig {
  // SMSGate specific
  baseUrl?: string;
  username?: string;
  password?: string;
  // Simple SMS Gateway specific
  simpleSmsGatewayBaseUrl?: string;
  // Auto-discovered request body schema (simple-sms-gateway)
  bodySchema?: DiscoveredSmsSchema | null;
  // Twilio specific
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
}

export interface SmsGatewayCreatePayload {
  name: string;
  provider: SmsGatewayProvider;
  config: SmsGatewayConfig;
  daily_limit?: number;
  monthly_limit?: number;
  is_active?: boolean;
  /**
   * Optional manual overrides for the auto-discovered request body
   * shape. Forwarded to the backend `POST /gateways` payload as-is.
   */
  overrides?: SmsGatewaySchemaOverrides;
}

export interface SmsGatewayTestResult {
  success: boolean;
  message: string;
}

/**
 * Result of a lightweight "discover only" request against the backend.
 * Returned by `POST /gateways?dryRun=true` so the user can preview the
 * detected endpoint/field names before saving the gateway.
 */
export interface SmsGatewayDiscoverResult {
  discoveredSchema: DiscoveredSmsSchema | null;
  reachabilityTest?: {
    success: boolean;
    message: string;
  };
}

export interface CampaignRecipientGateway {
  id: string;
  campaign_id: string;
  recipient_id: string;
  gateway_id: string | null;
  gateway_name: string | null;
  gateway_provider: string | null;
  assigned_at: string;
  sent_at: string | null;
}
