import HasHeaderField from './conditions/HasHeaderField';
import { EmailMessageTagExtractor } from './types';

const newsletterEmailMessage: EmailMessageTagExtractor = {
  tag: {
    name: 'newsletter',
    reachable: 1
  },
  rulesToCheck: [
    {
      fields: ['from'],
      conditions: [new HasHeaderField(['list-unsubscribe', 'list-id', 'list'])]
    }
  ]
};

export default newsletterEmailMessage;
