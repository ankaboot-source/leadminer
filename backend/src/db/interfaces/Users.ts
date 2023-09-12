import { User } from '@supabase/supabase-js';
import { Profile } from '../types';

export interface Users {
  deleteUser(userId: string): Promise<User | undefined>;
  deleteUserData(userId: string): Promise<true | undefined>;
  getById(userId: string): Promise<Profile | undefined>;
  update(
    userId: string,
    updateData?: Partial<Profile>
  ): Promise<boolean | undefined>;
}
