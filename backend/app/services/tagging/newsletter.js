const { HasSpecificHeaderField } = require('./rules');

const newsletterEmailMessage = {
  tag: {
    name: 'newsletter',
    reachability: 2
  },
  rulesToApply: [
    {
      fields: ['from', 'reply-to'],
      conditions: [
        new HasSpecificHeaderField(['list-unsubscribe', 'list-id', 'list'])
      ]
    }
  ]
};

module.exports = {
  newsletterEmailMessage
};
