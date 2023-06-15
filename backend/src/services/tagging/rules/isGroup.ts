
import { getSpecificHeader, hasHeaderWithValue } from '../../../utils/helpers/emailMessageHelpers';
import { EmailMessageContent, TaggingCondition } from '../types';

export class IdentifyGroupTagRules implements TaggingCondition {
    checkCondition({ header }: EmailMessageContent) {
  
      const hasRequiredHeader = getSpecificHeader(header, ['list-post', 'x-original-from']) !== null;
      const hasToMeetSomeConditions = hasHeaderWithValue(header, 'precedence', ['list'])
  
  
      return hasRequiredHeader || hasToMeetSomeConditions 
  
    }
  }