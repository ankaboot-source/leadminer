import type { SmsProvider } from "./types.ts";
import { TwilioProvider } from "./twilio-provider.ts";
import { SmsGateProvider } from "./smsgate-provider.ts";

export type { SmsProvider, SendSmsParams, SendSmsResult } from "./types.ts";

export function createSmsProvider(type: "twilio" | "smsgate"): SmsProvider {
  switch (type) {
    case "twilio":
      return new TwilioProvider();
    case "smsgate":
      return new SmsGateProvider();
    default:
      throw new Error(`Unknown SMS provider: ${type}`);
  }
}