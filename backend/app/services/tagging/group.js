const { HasHeaderField } = require('./conditions/HasHeaderField');
const {
  HasHeaderWithValues
} = require('./conditions/HasHeaderFieldWithValues');

const groupEmailMessage = {
  tag: {
    name: 'group',
    reachable: 2
  },
  rulesToApply: [
    {
      fields: ['list-post', 'reply-to', 'reply_to'],
      conditions: [
        new HasHeaderField(['list-post', 'x-original-from']),
        new HasHeaderWithValues('precedence', ['list'])
      ]
    }
  ]
};

module.exports = {
  groupEmailMessage
};
