import { getSpecificHeader } from '../../../utils/helpers/emailMessageHelpers';
import { EmailMessageContent, TaggingCondition } from '../types';

export class IdentifyNewsLetterRule implements TaggingCondition {
  checkCondition({
    header,
    emailDomainType,
    emailAddress,
    emailFoundIn
  }: EmailMessageContent) {
    const hasRequiredHeaderFields =
      getSpecificHeader(header, ['list-unsubscribe', 'list-id']) !== null;
    const hasPrecedenceHeaderField = !!header.precedence;

    const hasBulkPriority =
      hasPrecedenceHeaderField && header.precedence[0] === 'bulk';

    if (emailFoundIn && ['reply-to', 'reply_to'].includes(emailFoundIn)) {
      const hasAnewsLetterEmail = emailDomainType === 'newsletter';
      const hasSameEmail = header.to.includes(emailAddress);

      return hasSameEmail || hasAnewsLetterEmail || hasBulkPriority;
    }

    return hasPrecedenceHeaderField
      ? hasRequiredHeaderFields && hasBulkPriority
      : hasRequiredHeaderFields;
  }
}
