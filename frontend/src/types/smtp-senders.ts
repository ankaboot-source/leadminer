export type SmtpEncryption = 'starttls' | 'ssl' | 'none';
export type SmtpAuthType = 'password' | 'oauth';
export type SmtpOAuthProvider = 'google' | 'azure';

export interface SmtpSender {
  id: string;
  name: string;
  email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_encryption: SmtpEncryption;
  smtp_user: string;
  auth_type: SmtpAuthType;
  oauth_provider?: SmtpOAuthProvider;
  active: boolean;
  mining_source_email?: string;
  created_at: string;
  updated_at: string;
}

export interface SmtpSenderCreatePayload {
  name: string;
  email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_encryption: SmtpEncryption;
  smtp_user: string;
  smtp_password: string;
}

export interface SmtpSenderUpdatePayload {
  name?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_encryption?: SmtpEncryption;
  smtp_user?: string;
  smtp_password?: string;
  active?: boolean;
}

export interface SmtpAutodetectResult {
  smtpHost: string;
  smtpPort: number;
  smtpEncryption: SmtpEncryption;
  authType: SmtpAuthType;
  oauthProvider?: SmtpOAuthProvider;
}

export interface SmtpTestResult {
  success: boolean;
  message: string;
}
