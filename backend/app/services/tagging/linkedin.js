const {
  HasHeaderWithValues
} = require('./conditions/HasHeaderFieldWithValues');

const linkedinEmailMessage = {
  tag: {
    name: 'linkedin',
    reachable: 2
  },
  rulesToApply: [
    {
      fields: ['reply-to', 'reply_to'],
      conditions: [
        new HasHeaderWithValues('x-linkedin-class', ['inmail', 'email-default'])
      ]
    }
  ]
};

module.exports = {
  linkedinEmailMessage
};
