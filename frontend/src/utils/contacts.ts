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
    'enrich_contacts',
    // @ts-expect-error: Issue with @nuxt/supabase typing
    {
      p_contacts_data: [
        {
          user_id: userId,
          ...contact,
        },
      ],
      p_update_empty_fields_only: false,
    }
  );

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
      return 'bg-red-100 text-red-700';
    case 'professional':
      return 'bg-blue-100 text-blue-700';
    case 'newsletter':
      return 'p-tag-secondary';
    case 'group':
      return 'p-tag-secondary';
    case 'chat':
      return 'p-tag-secondary';
    default:
      return undefined;
  }
}
export function getTagLabel(value: string) {
  return tags().find((tag) => tag.value === value)?.label ?? 'unknown';
}
