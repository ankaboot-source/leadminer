import {
  createSmsProvider,
  type SmsProvider,
} from "../sms-campaigns/providers/mod.ts";

export type SmsFleetGateway = {
  id: string;
  user_id: string;
  name: string;
  provider: "smsgate" | "simple-sms-gateway" | "twilio";
  config: {
    baseUrl?: string;
    username?: string;
    password?: string;
    simpleSmsGatewayBaseUrl?: string;
  };
  is_active: boolean;
  daily_limit: number;
  monthly_limit: number;
  sent_today: number;
  sent_this_month: number;
};

export function createProviderForGateway(
  gateway: SmsFleetGateway,
): SmsProvider | null {
  const { config, provider } = gateway;

  switch (provider) {
    case "smsgate":
      if (config.baseUrl && config.username && config.password) {
        return createSmsProvider("smsgate", {
          smsgate: {
            baseUrl: config.baseUrl,
            username: config.username,
            password: config.password,
          },
        });
      }
      return null;
    case "simple-sms-gateway":
      if (config.simpleSmsGatewayBaseUrl) {
        return createSmsProvider("simple-sms-gateway", {
          simpleSmsGateway: { baseUrl: config.simpleSmsGatewayBaseUrl },
        });
      }
      return null;
    case "twilio":
      return createSmsProvider("twilio");
    default:
      return null;
  }
}
