import type { SmsProvider } from "./types.ts";
import { TwilioProvider } from "./twilio-provider.ts";
import {
  SmsGateProvider,
  type SmsGateCredentials,
} from "./smsgate-provider.ts";
import {
  SimpleSmsGatewayProvider,
  type SimpleSmsGatewayCredentials,
} from "./simple-sms-gateway-provider.ts";
import {
  SmsGatewayProvider,
  SMS_GATEWAY_PROVIDER_NAME,
  type SmsGatewayCredentials,
} from "./sms-gateway-provider.ts";

export type { SmsProvider, SendSmsParams, SendSmsResult } from "./types.ts";
export type { SmsGateCredentials } from "./smsgate-provider.ts";
export type { SimpleSmsGatewayCredentials } from "./simple-sms-gateway-provider.ts";
export type { SmsGatewayCredentials } from "./sms-gateway-provider.ts";
export { TwilioProvider, SMS_GATEWAY_PROVIDER_NAME };

export function isTwilioFallbackAvailable(): boolean {
  return TwilioProvider.isConfigured();
}

export function createSmsProvider(
  type: "twilio" | "smsgate" | "simple-sms-gateway" | "sms-gateway",
  options?: {
    smsgate?: SmsGateCredentials;
    simpleSmsGateway?: SimpleSmsGatewayCredentials;
    smsGateway?: SmsGatewayCredentials;
  },
): SmsProvider {
  switch (type) {
    case "twilio":
      return new TwilioProvider();
    case "smsgate":
      if (!options?.smsgate) {
        throw new Error("smsgate credentials required");
      }
      return new SmsGateProvider(options.smsgate);
    case "simple-sms-gateway":
      if (!options?.simpleSmsGateway) {
        throw new Error("simple-sms-gateway credentials required");
      }
      return new SimpleSmsGatewayProvider(options.simpleSmsGateway);
    case "sms-gateway":
      if (!options?.smsGateway) {
        throw new Error("sms-gateway credentials required");
      }
      return new SmsGatewayProvider(options.smsGateway);
    default:
      throw new Error(`Unknown SMS provider: ${type}`);
  }
}
