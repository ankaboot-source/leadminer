import { REACHABILITY } from '../../utils/constants';
import HasHeaderWithValues from './conditions/HasHeaderFieldWithValues';
import { EmailMessageTagExtractor } from './types';

const linkedinEmailMessage: EmailMessageTagExtractor = {
  tag: {
    name: 'linkedin',
    reachable: REACHABILITY.REACHABILITY_PERSON_DIRECT
  },
  rulesToCheck: [
    {
      fields: ['reply-to', 'reply_to'],
      conditions: [
        new HasHeaderWithValues('x-linkedin-class', [
          'inmail',
          'email-default',
          'mbr-to-mbr'
        ])
      ]
    }
  ]
};

export default linkedinEmailMessage;
