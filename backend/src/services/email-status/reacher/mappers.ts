import { EmailStatusResult, Status } from '../EmailStatusVerifier';
import { EmailCheckOutput } from './client';

export function reachableToEmailStatus(
  isReachable: 'invalid' | 'unknown' | 'safe' | 'risky'
): Status {
  switch (isReachable) {
    case 'invalid':
      return Status.INVALID;
    case 'unknown':
      return Status.UNKNOWN;
    case 'safe':
      return Status.VALID;
    case 'risky':
      return Status.RISKY;
    default:
      return Status.UNKNOWN;
  }
}

export function reacherResultToEmailStatus(
  reacherResult: EmailCheckOutput
): EmailStatusResult {
  return {
    email: reacherResult.input,
    status: reachableToEmailStatus(reacherResult!.is_reachable),
    details: {
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
          : undefined
    }
  };
}
