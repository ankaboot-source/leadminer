export interface ImapUser {
  id: string;
  email: string;
  host: string;
  port: number;
  tls: boolean;
}

export interface ImapUsers {
  create({
    email,
    host,
    port,
    tls
  }: {
    email: string;
    host: string;
    port: number;
    tls: boolean;
  }): Promise<ImapUser | null>;
  getByEmail(email: string): Promise<ImapUser | null>;
  getById(id: string): Promise<ImapUser | null>;
}
