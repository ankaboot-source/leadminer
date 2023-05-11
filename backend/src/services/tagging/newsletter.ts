import HasHeaderField from './conditions/HasHeaderField';
import { EmailMessageTagExtractor } from './types';

const newsletterEmailMessage: EmailMessageTagExtractor = {
  tag: {
    name: 'newsletter',
    reachable: 2
  },
  rulesToCheck: [
    {
      fields: ['from'],
      conditions: [
        new HasHeaderField(['list-post']),
        new HasHeaderField(['list-unsubscribe', 'list-id', 'list'])
      ]
    }
  ]
};

export default newsletterEmailMessage;
