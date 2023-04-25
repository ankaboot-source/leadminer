const { HasHeaderWithValues } =
  require('./conditions/HasHeaderFieldWithValues').default;

const linkedinEmailMessage = {
  tag: {
    name: 'linkedin',
    reachable: 2
  },
  rulesToApply: [
    {
      fields: ['reply-to', 'reply_to'],
      conditions: [
        new HasHeaderWithValues('x-linkedin-class', [
          'inmail',
          'email-default',
          'mbr-to-mbr'
        ])
      ]
    }
  ]
};

module.exports = {
  linkedinEmailMessage
};
