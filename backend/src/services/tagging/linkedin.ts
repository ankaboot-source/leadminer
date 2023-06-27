import { TAG_REACHABILITY_HIGH } from '../../utils/constants';
import HasHeaderWithValues from './conditions/HasHeaderFieldWithValues';
import { EmailMessageTagExtractor } from './types';

const linkedinEmailMessage: EmailMessageTagExtractor = {
  tag: {
    name: 'linkedin',
    reachable: TAG_REACHABILITY_HIGH
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
