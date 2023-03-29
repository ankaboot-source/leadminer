const { HasSpecificHeaderField } = require('./rules');

const groupEmailMessage = {
  tag: {
    name: 'group',
    reachability: 2
  },
  rulesToApply: [
    {
      fields: ['to', 'from'],
      conditions: [new HasSpecificHeaderField(['list-post', 'x-original-from'])]
    }
  ]
};

module.exports = {
  groupEmailMessage
};
