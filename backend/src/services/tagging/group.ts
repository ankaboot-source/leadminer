import { REACHABILITY } from '../../utils/constants';
import HasHeaderField from './conditions/HasHeaderField';
import HasHeaderWithValues from './conditions/HasHeaderFieldWithValues';
import { EmailMessageTagExtractor } from './types';

const groupEmailMessage: EmailMessageTagExtractor = {
  tag: {
    name: 'group',
    reachable: REACHABILITY.REACHABILITY_PERSON_DIRECT
  },
  rulesToCheck: [
    {
      fields: ['list-post'],
      conditions: [
        new HasHeaderField(['list-post', 'x-original-from']),
        new HasHeaderWithValues('precedence', ['list'])
      ]
    },
    {
      fields: ['reply-to', 'reply_to'],
      conditions: [new HasHeaderField(['mailing-list'])] // For Yahoo
    }
  ]
};

export default groupEmailMessage;
