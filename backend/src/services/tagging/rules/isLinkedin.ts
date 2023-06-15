import { hasHeaderWithValue } from '../../../utils/helpers/emailMessageHelpers';
import { EmailMessageContent, TaggingCondition } from '../types';

class IdentifyLinkedinTagRules implements TaggingCondition {
  checkCondition({ header }: EmailMessageContent) {
    return hasHeaderWithValue(header, 'x-linkedin-class', [
      'inmail',
      'email-default',
      'mbr-to-mbr'
    ]);
  }
}

export default IdentifyLinkedinTagRules;
