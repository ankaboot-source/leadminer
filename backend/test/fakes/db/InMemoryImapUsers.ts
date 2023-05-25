import { ImapUser, ImapUsers } from '../../../src/db/ImapUsers';

export default class InMemoryImapUsers implements ImapUsers {
  private readonly users: ImapUser[] = [];

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
  }): Promise<ImapUser | null> {
    const user: ImapUser = {
      id: this.users.length.toString(),
      email,
      host,
      port,
      tls
    };

    this.users.push(user);

    return Promise.resolve({ ...user });
  }

  getByEmail(email: string): Promise<ImapUser | null> {
    const user = this.users.find((u) => u.email === email);
    if (user) {
      return Promise.resolve({ ...user } as ImapUser);
    }
    return Promise.resolve(null);
  }

  getById(id: string): Promise<ImapUser | null> {
    const user = this.users.find((u) => u.id === id);
    if (user) {
      return Promise.resolve({ ...user } as ImapUser);
    }
    return Promise.resolve(null);
  }
}
