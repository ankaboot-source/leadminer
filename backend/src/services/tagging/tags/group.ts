import { REACHABILITY } from '../../../utils/constants';
import HasHeaderField from '../conditions/HasHeaderField';
import HasHeaderWithValues from '../conditions/HasHeaderFieldWithValues';
import { Tag } from '../types';

const groupEmailMessage: Tag = {
  tag: {
    name: 'group',
    reachable: REACHABILITY.MANY_OR_INDIRECT_PERSON
  },
  rules: [
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
