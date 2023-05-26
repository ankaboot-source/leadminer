export interface OAuthUser {
  id: string;
  email: string;
  refresh_token: string;
}

export interface OAuthUsers {
  create({
    email,
    refreshToken
  }: {
    email: string;
    refreshToken: string;
  }): Promise<OAuthUser | null>;
  getByEmail(email: string): Promise<OAuthUser | null>;
  getById(id: string): Promise<OAuthUser | null>;
  updateRefreshToken(
    id: string,
    refreshToken: string
  ): Promise<OAuthUser | null>;
  findOrCreateOne(
    email: string,
    refreshToken: string
  ): Promise<OAuthUser | null>;
}
