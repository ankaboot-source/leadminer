import type { User } from '@supabase/supabase-js';
import type { Contact } from '~/types/contact';
import type { Organization } from '~/types/organization';

export function convertDates(data: Contact[]) {
  return [...data].map((d) => {
    if (d.recency) {
      d.recency = new Date(d.recency);
    }
    if (d.seniority) {
      d.seniority = new Date(d.seniority);
    }
    if (d.updated_at) {
      d.updated_at = new Date(d.updated_at);
    }
    if (d.created_at) {
      d.created_at = new Date(d.created_at);
    }
    return d;
  });
}

/**
 * Retrieves an organization by its name from the `organizations` table.
 *
 * @param organizationName - The name of the organization to retrieve.
 * @param selectFields - An array of fields to select from the organization record.
 * @returns The organization object if found, or `null` if not.
 * @throws Will throw an error if the query fails.
 */
export async function getOrganization(
  match: { name: string } | { id: string },
  selectFields: (keyof Organization)[],
) {
  const $supabaseClient = useSupabaseClient();
  const { data: existingOrg, error } = await $supabaseClient
    // @ts-expect-error: Issue with nuxt/supabase
    .schema('private')
    .from('organizations')
    .select(selectFields.join(','))
    .match(match)
    .maybeSingle<Organization>();

  if (error) {
    throw error;
  }

  return existingOrg ?? null;
}

/**
 * Creates a new organization in the `organizations` table with the specified name.
 *
 * @param organizationName - The name of the organization to create.
 * @param selectFields - An array of fields to select from the newly created organization record.
 * @returns The newly created organization object, or `null` if creation fails.
 * @throws Will throw an error if the insertion fails.
 */
export async function createOrganization(
  organizationName: string,
  selectFields: (keyof Organization)[],
) {
  const $supabaseClient = useSupabaseClient();
  const { data: newOrg, error } = await $supabaseClient
    // @ts-expect-error: Issue with nuxt/supabase
    .schema('private')
    .from('organizations')
    .insert({ name: organizationName })
    .select(selectFields.join(','))
    .single<Organization>();

  if (error) {
    throw error;
  }

  return newOrg ?? null;
}

export async function updateContact(userId: string, contact: Partial<Contact>) {
  const $supabaseClient = useSupabaseClient();

  if (contact.works_for) {
    contact.works_for =
      (
        (await getOrganization({ name: contact.works_for }, ['id'])) ??
        (await createOrganization(contact.works_for, ['id']))
      ).id || null;
  }

  if (!contact.email) {
    throw new Error('Email is required for updating a contact');
  }

  const { error } = await $supabaseClient
    // @ts-expect-error: Issue with nuxt/supabase
    .schema('private')
    .from('persons')
    .update(contact)
    .match({ user_id: userId, email: contact.email });

  if (error) {
    throw error;
  }
}

export const tags = () => {
  const { t } = useNuxtApp().$i18n;
  return [
    { value: 'professional', label: t('contact.tag.professional') },
    { value: 'newsletter', label: t('contact.tag.newsletter') },
    { value: 'personal', label: t('contact.tag.personal') },
    { value: 'group', label: t('contact.tag.group') },
    { value: 'chat', label: t('contact.tag.chat') },
    { value: 'role', label: t('contact.tag.role') },
  ];
};

type Status = {
  value: 'VALID' | 'RISKY' | 'INVALID' | 'UNKNOWN' | null;
  label: string;
  color: 'success' | 'warn' | 'danger' | 'secondary';
};

export const statuses = () => {
  const { t } = useNuxtApp().$i18n;
  return [
    { value: 'VALID', label: t('contact.status.valid'), color: 'success' },
    { value: 'RISKY', label: t('contact.status.risky'), color: 'warn' },
    { value: 'INVALID', label: t('contact.status.invalid'), color: 'danger' },
    {
      value: 'UNKNOWN',
      label: t('contact.status.unknown'),
      color: 'secondary',
    },
    { value: null, label: t('contact.status.unverified'), color: 'secondary' },
  ] as Status[];
};

export function getStatusColor(value: Status['value']): Status['color'] {
  return (
    statuses().find((status) => status.value === value)?.color ?? 'secondary'
  );
}
export function getStatusLabel(value: Status['value']): Status['label'] {
  const { t } = useNuxtApp().$i18n;
  return (
    statuses().find((status) => status.value === value)?.label ??
    t('contact.unverified')
  );
}
export function getTagColor(tag: string) {
  if (!tag) return undefined;
  switch (tag) {
    case 'personal':
      return 'danger';
    case 'professional':
      return 'info';
    case 'newsletter':
      return 'secondary';
    case 'group':
      return 'secondary';
    case 'chat':
      return 'secondary';
    case 'role':
      return 'secondary';
    default:
      return undefined;
  }
}
export function getTagLabel(value: string) {
  return tags().find((tag) => tag.value === value)?.label ?? 'unknown';
}

export function isValidURL(url: string) {
  try {
    // skipcq: JS-R1002 - instantiating unused object as the url validity checker
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export async function removeContactsFromDatabase(
  emails?: string[],
): Promise<void> {
  const $user = useSupabaseUser() as Ref<User>;
  const $supabaseClient = useSupabaseClient();
  const { error } = await $supabaseClient
    // @ts-expect-error: Issue with nuxt/supabase
    .schema('private')
    .rpc('delete_contacts', {
      user_id: $user.value.id,
      emails: emails,
      deleteallcontacts: emails === undefined,
    });
  if (error) throw error;
}
