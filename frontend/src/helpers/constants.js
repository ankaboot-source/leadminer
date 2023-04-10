const EMAIL_EXCLUDED_FOLDERS = [
  "junk",
  "mailspring",
  "spam",
  "corbeille",
  "brouillons",
  "draft",
  "trashed",
  "trash",
  "drafts",
  "important",
  "sent mail",
  "starred",
  "deleted",
  "outbox",
];

export const GMAIL_EXCLUDED_FOLDERS = ["inbox", ...EMAIL_EXCLUDED_FOLDERS];
export const OUTLOOK_EXCLUDED_FOLDERS = [...EMAIL_EXCLUDED_FOLDERS];
