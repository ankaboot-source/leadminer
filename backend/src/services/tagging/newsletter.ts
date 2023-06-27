import { REACHABILITY } from '../../utils/constants';
import HasHeaderField from './conditions/HasHeaderField';
import HasNoHeaderField from './conditions/HasNoHeaderField';
import { EmailMessageTagExtractor } from './types';

const newsletterEmailMessage: EmailMessageTagExtractor = {
  tag: {
    name: 'newsletter',
    reachable: REACHABILITY.REACHABILITY_MANY_INDIRECT
  },
  requiredConditions: [new HasNoHeaderField(['list-post'])],
  rulesToCheck: [
    {
      fields: ['from', 'reply_to', 'reply-to'],
      conditions: [new HasHeaderField(['list-unsubscribe', 'list-id', 'list'])]
    }
  ]
};

export default newsletterEmailMessage;
