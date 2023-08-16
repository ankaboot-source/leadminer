import { User } from '@supabase/supabase-js';
import { Request } from 'express';

export default interface AuthResolver {
  getAccessToken(req: Request): string | undefined;
  getUser(accessToken: string): Promise<User | undefined>;
  deleteUser(userId: string): Promise<User | undefined>;
  deleteUserData(userId: string): Promise<true | undefined>;
}
