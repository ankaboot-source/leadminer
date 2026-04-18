export interface SmsProvider {
  name: string;
  send(params: SendSmsParams): Promise<SendSmsResult>;
}

export interface SendSmsParams {
  to: string;
  from: string;
  body: string;
}

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
