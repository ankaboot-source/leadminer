type SenderOptionLike = {
  email?: string;
  available?: boolean;
};

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
