import type { SmsProvider } from "./types.ts";
import { TwilioProvider } from "./twilio-provider.ts";
import { SmsGateProvider, type SmsGateCredentials } from "./smsgate-provider.ts";

export type { SmsProvider, SendSmsParams, SendSmsResult } from "./types.ts";
export type { SmsGateCredentials } from "./smsgate-provider.ts";

export function isTwilioFallbackAvailable(): boolean {
  return TwilioProvider.isConfigured();
}

export function createSmsProvider(
  type: "twilio" | "smsgate",
  options?: { smsgate?: SmsGateCredentials },
): SmsProvider {
  switch (type) {
    case "twilio":
      return new TwilioProvider();
    case "smsgate":
      if (!options?.smsgate) {
        throw new Error("SMSGate credentials required");
      }
      return new SmsGateProvider(options.smsgate);
    default:
      throw new Error(`Unknown SMS provider: ${type}`);
  }
}
