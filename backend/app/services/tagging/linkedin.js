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
      conditions: [new HasHeaderWithValues('X-LinkedIn-Class', ['INMAIL'])]
    }
  ]
};

module.exports = {
  linkedinEmailMessage
};
