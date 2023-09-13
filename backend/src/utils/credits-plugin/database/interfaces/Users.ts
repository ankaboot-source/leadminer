export interface Profile {
  user_id: string;
  email: string;
  credits: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface Users {
  create(
    customerEmail: string,
    customerName: string | null | undefined
  ): Promise<Profile>;
  update(userId: string, data: Partial<Profile>): Promise<Profile | null>;
  getByEmail(email: string): Promise<Profile | null>;
  getBySubscriptionId(subscriptionId: string): Promise<Profile | null>;
  inviteUserByEmail(email: string): Promise<true | Error>;
  generateMagicLink(email: string): Promise<string>;
}
