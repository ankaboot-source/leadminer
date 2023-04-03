const {
  HasHeaderFieldStartsWith
} = require('./conditions/HasHeaderFieldStartsWith');
const {
  HasHeaderWithValues
} = require('./conditions/HasHeaderFieldWithValues');

const transactionalEmailMessage = {
  tag: {
    name: 'transactional',
    reachable: 2
  },
  rulesToApply: [
    {
      fields: ['from', 'reply-to', 'reply_to'],
      conditions: [
        new HasHeaderFieldStartsWith([
          'feedback-id',
          'x-feedback-id',
          'x-mandrill-user',
          'x-marketoid',
          'x-campaignid',
          'x-job',
          'x-linkedin',
          'x-mailgun',
          'x-github',
          'x-gnd-status'
        ]),
        new HasHeaderWithValues('x-mailer', [
          'ec-messenger',
          'nlserver',
          'mailchimp'
        ]),
        new HasHeaderWithValues('auto-submitted', ['auto-generated'])
      ]
    }
  ]
};

module.exports = {
  transactionalEmailMessage
};
