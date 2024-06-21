import { Details, Status } from '../EmailStatusVerifier';
import {
  ZerobounceEmailValidationResult,
  ZerobounceStatusResult
} from './client';

const mapper: Record<
  ZerobounceStatusResult,
  { status: Status; details: Details }
> = {
  valid: {
    details: {
      isDeliverable: true
    },
    status: Status.VALID
  },
  invalid: {
    details: {},
    status: Status.INVALID
  },
  unknown: {
    details: {},
    status: Status.UNKNOWN
  },
  'catch-all': {
    details: {
      isCatchAll: true
    },
    status: Status.UNKNOWN
  },
  spamtrap: {
    details: {},
    status: Status.INVALID
  },
  abuse: {
    details: {},
    status: Status.INVALID
  },
  do_not_mail: {
    details: {},
    status: Status.INVALID
  }
};

export default function zerobounceResultToEmailStatusResultMapper(
  result: ZerobounceEmailValidationResult
) {
  const mappedResult = mapper[result.status];
  mappedResult.details.status = result.status;
  mappedResult.details.sub_status = result.sub_status;
  mappedResult.details.source = 'zerobounce';

  return mappedResult;
}
