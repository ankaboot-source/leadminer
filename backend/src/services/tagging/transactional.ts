import HasHeaderFieldStartsWith from './conditions/HasHeaderFieldStartsWith';
import HasHeaderWithValues from './conditions/HasHeaderFieldWithValues';
import { EmailMessageTagExtractor } from './types';

const transactionalEmailMessage: EmailMessageTagExtractor = {
  tag: {
    name: 'transactional',
    reachable: 2
  },
  rulesToCheck: [
    {
      fields: ['from'],
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
          'x-msfbl'
        ]),
        new HasHeaderWithValues('x-mailer', [
          'ec-messenger',
          'nlserver',
          'mailchimp',
          'nodemailer'
        ]),
        new HasHeaderWithValues('auto-submitted', ['auto-generated']),
        new HasHeaderWithValues('x-gnd-status', [
          'pce',
          'mce',
          'spam',
          'social',
          'purchase',
          'account',
          'travel',
          'finance',
          'alerting',
          'bounce',
          'suspect'
        ]),
        new HasHeaderWithValues('x-spam-flag', ['true'])
      ]
    }
  ]
};

export default transactionalEmailMessage;
