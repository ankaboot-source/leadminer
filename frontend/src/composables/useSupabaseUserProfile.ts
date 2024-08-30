import type { Profile } from '~/types/profile';
import { useState } from '#imports';

export const useSupabaseUserProfile = () =>
  useState<Profile | null>('supabase_user_profile', () => null);
