import { Details, EmailStatusResult, Status } from '../EmailStatusVerifier';
import { EmailCheckOutput, Reachability } from './client';

export function reacherResultToEmailStatus(
  reachability: Reachability,
  details: Details
): Status {
  if (details.isCatchAll === true) {
    return Status.UNKNOWN;
  }
  if (details.isRole === true || details.hasFullInbox === true) {
    return Status.RISKY;
  }
  if (details.isDisposable === true) {
    return Status.INVALID;
  }

  switch (reachability) {
    case 'safe':
      return Status.VALID;
    case 'invalid':
      return Status.INVALID;
    case 'unknown':
      return Status.UNKNOWN;
    case 'risky':
      return Status.RISKY;
    default:
      return Status.UNKNOWN;
  }
}

export function reacherResultToEmailStatusWithDetails(
  reacherResult: EmailCheckOutput
): EmailStatusResult {
  const details: Details = {
    isRole:
      'is_role_account' in reacherResult.misc
        ? reacherResult.misc.is_role_account
        : undefined,
    isDisposable:
      'is_disposable' in reacherResult.misc
        ? reacherResult.misc.is_disposable
        : undefined,
    isDisabled:
      'is_disabled' in reacherResult.smtp
        ? reacherResult.smtp.is_disabled
        : undefined,
    isCatchAll:
      'is_catch_all' in reacherResult.smtp
        ? reacherResult.smtp.is_catch_all
        : undefined,
    isDeliverable:
      'is_deliverable' in reacherResult.smtp
        ? reacherResult.smtp.is_deliverable
        : undefined,
    hasFullInbox:
      'has_full_inbox' in reacherResult.smtp
        ? reacherResult.smtp.has_full_inbox
        : undefined,
    source: 'reacher'
  };
  return {
    email: reacherResult.input,
    status: reacherResultToEmailStatus(reacherResult.is_reachable, details),
    details
  };
}
