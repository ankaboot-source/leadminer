const { HasHeaderField } = require('./conditions/HasHeaderField');

const groupEmailMessage = {
  tag: {
    name: 'group',
    reachability: 2
  },
  rulesToApply: [
    {
      fields: ['to', 'from'],
      conditions: [new HasHeaderField(['list-post', 'x-original-from'])]
    }
  ]
};

module.exports = {
  groupEmailMessage
};
