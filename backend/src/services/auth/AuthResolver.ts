import { User } from '@supabase/supabase-js';
import { Request } from 'express';
import { Profile } from './types';

export default interface AuthResolver {
  getAccessToken(req: Request): string | undefined;
  getUser(accessToken: string): Promise<User | undefined>;
  getProfile(userId: string): Promise<Profile | undefined>;
  updateProfile(
    userId: string,
    updateData?: Partial<Profile>
  ): Promise<boolean | undefined>;
  deleteUser(userId: string): Promise<User | undefined>;
  deleteUserData(userId: string): Promise<true | undefined>;
}
