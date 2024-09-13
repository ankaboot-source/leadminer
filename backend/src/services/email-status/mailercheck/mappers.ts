import { Details, Status } from '../EmailStatusVerifier';
import { MailerCheckResult } from './client';

const mapper: Record<MailerCheckResult, { status: Status; details: Details }> =
  {
    catch_all: {
      details: {
        isCatchAll: true
      },
      status: Status.UNKNOWN
    },
    disposable: {
      details: {
        isDisposable: true
      },
      status: Status.INVALID
    },
    mailbox_full: {
      details: {
        hasFullInbox: true
      },
      status: Status.RISKY
    },
    valid: {
      details: {
        isDeliverable: true
      },
      status: Status.VALID
    },
    role: {
      details: {
        isRole: true
      },
      status: Status.RISKY
    },
    unknown: {
      details: {},
      status: Status.UNKNOWN
    },
    past_delivery_issues: {
      details: { hasPastDeliveryIssues: true },
      status: Status.RISKY
    },
    blocked: {
      details: { isBlocked: true },
      status: Status.INVALID
    },
    mailbox_not_found: {
      details: { isNotFound: true },
      status: Status.INVALID
    },
    syntax_error: {
      details: { isNotFound: true },
      status: Status.INVALID
    },
    typo: {
      details: { isNotFound: true },
      status: Status.INVALID
    },
    error: {
      details: { isNotFound: true },
      status: Status.INVALID
    }
  };

export default function mailerCheckResultToEmailStatusResultMapper(
  result: MailerCheckResult
) {
  const mappedResult = mapper[result];
  mappedResult.details.source = 'mailercheck';

  return mappedResult;
}
