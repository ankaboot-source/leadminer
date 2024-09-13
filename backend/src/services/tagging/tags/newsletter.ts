import { REACHABILITY } from '../../../utils/constants';
import HasHeaderField from '../conditions/HasHeaderField';
import HasNoHeaderField from '../conditions/HasNoHeaderField';
import { Tag } from '../types';

const newsletterEmailMessage: Tag = {
  tag: {
    name: 'newsletter',
    reachable: REACHABILITY.UNSURE
  },
  prerequisiteConditions: [new HasNoHeaderField(['list-post'])],
  rules: [
    {
      fields: ['from', 'reply_to', 'reply-to'],
      conditions: [new HasHeaderField(['list-unsubscribe', 'list-id', 'list'])]
    }
  ]
};

export default newsletterEmailMessage;
