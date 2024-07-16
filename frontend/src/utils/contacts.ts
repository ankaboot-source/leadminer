import type { Contact, ContactEdit } from '~/types/contact';

function convertDates(data: Contact[]) {
  return [...data].map((d) => {
    if (d.recency) {
      d.recency = new Date(d.recency);
    }
    if (d.seniority) {
      d.seniority = new Date(d.seniority);
    }
    return d;
  });
}

export async function getContacts(userId: string): Promise<Contact[]> {
  const $supabaseClient = useSupabaseClient();
  const { data, error } = await $supabaseClient.rpc(
    'get_contacts_table',
    // @ts-expect-error: Issue with @nuxt/supabase typing
    { userid: userId }
  );

  if (error) {
    throw error;
  }

  return data ? convertDates(data) : [];
}

export async function updateContact(userId: string, contact: ContactEdit) {
  const $supabaseClient = useSupabaseClient();
  const { error } = await $supabaseClient.rpc(
    'update_contact_by_email',
    // @ts-expect-error: Issue with @nuxt/supabase typing
    {
      user_id: userId,
      ...contact,
    }
  );

  if (error) {
    throw error;
  }
}
