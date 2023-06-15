import { hasHeaderWithValue } from '../../../utils/helpers/emailMessageHelpers';
import { EmailMessageContent, TaggingCondition } from '../types';


export class IdentifyLinkedinTagRules implements TaggingCondition {
  checkCondition({ header }: EmailMessageContent) {
    return hasHeaderWithValue(header, 'x-linkedin-class', ['inmail', 'email-default', 'mbr-to-mbr'])
  }
}
