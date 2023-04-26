import HasHeaderField from './conditions/HasHeaderField';
import HasHeaderWithValues from './conditions/HasHeaderFieldWithValues';

const groupEmailMessage = {
  tag: {
    name: 'group',
    reachable: 2
  },
  rulesToApply: [
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
