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
      email: contact.email,
      given_name: contact.given_name || null,
      family_name: contact.family_name || null,
      alternate_names: contact.alternate_names
        ? (contact?.alternate_names as String)
            ?.split('\n')
            .filter((item) => item.length)
        : null,
      address: contact.address || null,
      works_for: contact.works_for || null,
      job_title: contact.job_title || null,
      same_as: contact.same_as
        ? (contact.same_as as String)?.split('\n').filter((item) => item.length)
        : null,
      image: contact.image || null,
    }
  );

  if (error) {
    throw error;
  }
}
