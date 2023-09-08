export interface Profile {
  user_id: string;
  email: string;
  credits: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface Profiles {
  createNewUserProfile(
    customerEmail: string,
    customerName: string | null | undefined
  ): Promise<Profile | null>;
  getUserProfileByEmail(userId: string): Promise<Profile | null>;
  getUserProfileBySubscriptionId(userId: string): Promise<Profile | null>;
  updateUserProfile(
    userId: string,
    data: Partial<Profile>
  ): Promise<Profile | null>;
}
