import { User } from '@supabase/supabase-js';
import { Profile } from '../types';

export interface Users {
  deleteUser(userId: string): Promise<User | undefined>;
  deleteUserData(userId: string): Promise<true | undefined>;
  getUserProfile(userId: string): Promise<Profile | undefined>;
  updateUserProfile(
    userId: string,
    updateData?: Partial<Profile>
  ): Promise<boolean | undefined>;
}
