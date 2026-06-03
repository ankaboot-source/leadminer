export type SmtpEncryption = 'starttls' | 'ssl' | 'none';
export type SmtpAuthType = 'password' | 'oauth';
export type SmtpOAuthProvider = 'google' | 'azure';

export interface SmtpSender {
  id: string;
  userId: string;
  name: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpEncryption: SmtpEncryption;
  smtpUser: string;
  authType: SmtpAuthType;
  oauthProvider?: SmtpOAuthProvider;
  active: boolean;
  miningSourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SmtpSenderCreate {
  userId: string;
  name: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpEncryption: SmtpEncryption;
  smtpUser: string;
  smtpPassword: string;
  authType?: SmtpAuthType;
  oauthProvider?: SmtpOAuthProvider;
  oauthRefreshToken?: string;
  miningSourceId?: string;
}

export interface SmtpSenderUpdate {
  name?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpEncryption?: SmtpEncryption;
  smtpUser?: string;
  smtpPassword?: string;
  active?: boolean;
}

export interface SmtpSenders {
  getByUser(userId: string): Promise<SmtpSender[]>;
  getById(id: string, userId: string): Promise<SmtpSender | null>;
  create(sender: SmtpSenderCreate): Promise<SmtpSender>;
  update(
    id: string,
    userId: string,
    updates: SmtpSenderUpdate
  ): Promise<SmtpSender | null>;
  delete(id: string, userId: string): Promise<boolean>;
  deleteByMiningSourceId(
    userId: string,
    miningSourceId: string
  ): Promise<boolean>;
  getPassword(id: string, userId: string): Promise<string | null>;
}
