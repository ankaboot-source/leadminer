export interface ExtractionProgressInput {
  extractedEmails: number;
  scannedEmails: number;
  totalEmails: number;
  fetchingFinished: boolean;
  canceled: boolean;
  googleContactsSync: boolean;
  googleContactsFetchedCount: number;
  googleContactsTotal: number;
}

/**
 * Progress of the extraction phase, on a 0..1 scale.
 *
 * The backend `extracted` counter includes google-contacts stream entries
 * (they share the messages stream with IMAP messages), so the denominator
 * must include google-contacts totals whenever the sync flag is enabled —
 * otherwise the bar overshoots 100%.
 */
export function computeExtractionProgress(
  input: ExtractionProgressInput,
): number {
  const {
    extractedEmails,
    scannedEmails,
    totalEmails,
    fetchingFinished,
    canceled,
    googleContactsSync,
    googleContactsFetchedCount,
    googleContactsTotal,
  } = input;

  const emailTotal =
    fetchingFinished && !canceled ? scannedEmails : totalEmails;

  const googleTotal = googleContactsSync
    ? Math.max(googleContactsFetchedCount, googleContactsTotal)
    : 0;

  const denominator = emailTotal + googleTotal;
  if (!denominator || denominator <= 0) return 0;

  return Math.min(extractedEmails / denominator, 1);
}
