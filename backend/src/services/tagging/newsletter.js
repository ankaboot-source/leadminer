import HasHeaderField from './conditions/HasHeaderField';

const newsletterEmailMessage = {
  tag: {
    name: 'newsletter',
    reachable: 2
  },
  rulesToApply: [
    {
      fields: ['from', 'reply-to', 'reply_to'],
      conditions: [new HasHeaderField(['list-unsubscribe', 'list-id', 'list'])]
    }
  ]
};

export default newsletterEmailMessage;
