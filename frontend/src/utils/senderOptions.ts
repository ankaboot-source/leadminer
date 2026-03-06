type SenderOptionLike = {
  email?: string;
  available?: boolean;
};

export type UnavailableSenderReconnectContext =
  | { mode: 'none' }
  | { mode: 'single'; email: string }
  | { mode: 'multiple' };

export function extractUnavailableSenderEmails(
  options: SenderOptionLike[],
): string[] {
  const uniqueEmails = new Set<string>();

  for (const option of options) {
    if (option.available) {
      continue;
    }

    const normalizedEmail = String(option.email || '')
      .trim()
      .toLowerCase();
    if (!normalizedEmail) {
      continue;
    }

    uniqueEmails.add(normalizedEmail);
  }

  return [...uniqueEmails];
}

export function getUnavailableSenderReconnectContext(
  unavailableEmails: string[],
): UnavailableSenderReconnectContext {
  if (unavailableEmails.length === 0) {
    return { mode: 'none' };
  }

  if (unavailableEmails.length === 1) {
    return {
      mode: 'single',
      email: unavailableEmails[0],
    };
  }

  return { mode: 'multiple' };
}
