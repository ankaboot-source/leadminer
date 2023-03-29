const { HasHeaderField } = require('./conditions/HasHeaderField');

const newsletterEmailMessage = {
  tag: {
    name: 'newsletter',
    reachability: 2
  },
  rulesToApply: [
    {
      fields: ['from', 'reply-to'],
      conditions: [new HasHeaderField(['list-unsubscribe', 'list-id', 'list'])]
    }
  ]
};

module.exports = {
  newsletterEmailMessage
};
