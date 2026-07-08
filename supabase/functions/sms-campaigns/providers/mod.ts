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
  SmsGatewayIosProvider,
  SMS_GATEWAY_IOS_PROVIDER_NAME,
  SMS_GATEWAY_IOS_APP_ID,
  type SmsGatewayIosCredentials,
} from "./sms-gateway-ios-provider.ts";

export type { SmsProvider, SendSmsParams, SendSmsResult } from "./types.ts";
export type { SmsGateCredentials } from "./smsgate-provider.ts";
export type { SimpleSmsGatewayCredentials } from "./simple-sms-gateway-provider.ts";
export type { SmsGatewayIosCredentials } from "./sms-gateway-ios-provider.ts";
export {
  TwilioProvider,
  SMS_GATEWAY_IOS_PROVIDER_NAME,
  SMS_GATEWAY_IOS_APP_ID,
};

/**
 * Curated registry of known SMS gateway apps the user can add. Each
 * entry pairs a `provider` (the `SmsProvider` implementation) with a
 * stable `appId` (stored in the gateway's `config.appId`) and a
 * human-readable `displayName` shown in the setup dialog.
 *
 * To add a new app:
 *   1. Implement an `SmsProvider` (see `sms-gateway-ios-provider.ts`).
 *   2. Add it to `case` branches in `createSmsProvider` below.
 *   3. Add an entry here.
 */
export interface KnownSmsApp {
  appId: string;
  displayName: string;
  provider: "simple-sms-gateway" | "sms-gateway-ios";
}

export const KNOWN_SMS_APPS: readonly KnownSmsApp[] = [
  {
    appId: "android-simple-sms-gateway",
    displayName: "Simple SMS Gateway (Android)",
    provider: "simple-sms-gateway",
  },
  {
    appId: SMS_GATEWAY_IOS_APP_ID,
    displayName: "SMS Gateway (iOS)",
    provider: SMS_GATEWAY_IOS_PROVIDER_NAME,
  },
] as const;

export function isTwilioFallbackAvailable(): boolean {
  return TwilioProvider.isConfigured();
}

export function createSmsProvider(
  type: "twilio" | "smsgate" | "simple-sms-gateway" | "sms-gateway-ios",
  options?: {
    smsgate?: SmsGateCredentials;
    simpleSmsGateway?: SimpleSmsGatewayCredentials;
    smsGatewayIos?: SmsGatewayIosCredentials;
  },
): SmsProvider {
  switch (type) {
    case "twilio":
      return new TwilioProvider();
    case "smsgate":
      if (!options?.smsgate) {
        throw new Error("SMSGate credentials required");
      }
      return new SmsGateProvider(options.smsgate);
    case "simple-sms-gateway":
      if (!options?.simpleSmsGateway) {
        throw new Error("simple-sms-gateway credentials required");
      }
      return new SimpleSmsGatewayProvider(options.simpleSmsGateway);
    case "sms-gateway-ios":
      if (!options?.smsGatewayIos) {
        throw new Error("SMS Gateway (iOS) credentials required");
      }
      return new SmsGatewayIosProvider(options.smsGatewayIos);
    default:
      throw new Error(`Unknown SMS provider: ${type}`);
  }
}
