import { REACHABILITY } from '../../../utils/constants';
import HasHeaderWithValues from '../conditions/HasHeaderFieldWithValues';
import { Tag } from '../types';

const linkedinEmailMessage: Tag = {
  tag: {
    name: 'linkedin',
    reachable: REACHABILITY.MANY_OR_INDIRECT_PERSON
  },
  rules: [
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
