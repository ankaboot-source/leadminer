const { HasHeaderField } = require('./conditions/HasHeaderField').default;
const { HasHeaderWithValues } =
  require('./conditions/HasHeaderFieldWithValues').default;

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

module.exports = {
  groupEmailMessage
};
