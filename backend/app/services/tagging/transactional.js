const {
  HasHeaderFieldStartsWith,
  HasHeaderWithValues,
  HasSpecificHeaderField
} = require('./rules');

const transactionalEmailMessage = {
  tag: {
    name: 'transactional',
    reachability: 2
  },
  rulesToApply: [
    {
      fields: ['from', 'reply-to'],
      conditions: [
        new HasHeaderFieldStartsWith([
          'feedback-id',
          'x-feedback-id',
          'x-mandrill-user',
          'x-marketoid',
          'x-campaignid',
          'x-job'
        ]),
        new HasHeaderWithValues('x-mailer', [
          'ec-messenger',
          'nlserver',
          'mailchimp'
        ]),
        new HasSpecificHeaderField([
          'x-linkedin',
          'x-mailgun',
          'auto-submitted',
          'x-github'
        ])
      ]
    }
  ]
};

module.exports = {
  transactionalEmailMessage
};
