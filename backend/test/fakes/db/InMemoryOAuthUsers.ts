import { OAuthUser, OAuthUsers } from '../../../src/db/OAuthUsers';

export default class InMemoryOAuthUsers implements OAuthUsers {
  private readonly users: OAuthUser[] = [];

  create({
    email,
    refreshToken
  }: {
    email: string;
    refreshToken: string;
  }): Promise<OAuthUser | null> {
    const user = {
      id: this.users.length.toString(),
      email,
      refresh_token: refreshToken
    } as OAuthUser;

    this.users.push(user);

    return Promise.resolve({ ...user });
  }

  getByEmail(email: string): Promise<OAuthUser | null> {
    const user = this.users.find((u) => u.email === email);
    if (user) {
      return Promise.resolve({ ...user } as OAuthUser);
    }
    return Promise.resolve(null);
  }

  getById(id: string): Promise<OAuthUser | null> {
    const user = this.users.find((u) => u.id === id);
    if (user) {
      return Promise.resolve({ ...user } as OAuthUser);
    }
    return Promise.resolve(null);
  }

  updateRefreshToken(
    id: string,
    refreshToken: string
  ): Promise<OAuthUser | null> {
    const user = this.users.find((u) => u.id === id);
    if (user) {
      user.refresh_token = refreshToken;
      return Promise.resolve({ ...user } as OAuthUser);
    }
    return Promise.resolve(null);
  }
}
