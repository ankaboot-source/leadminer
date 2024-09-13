import { REACHABILITY } from '../../../utils/constants';
import HasHeaderFieldStartsWith from '../conditions/HasHeaderFieldStartsWith';
import HasHeaderWithValues from '../conditions/HasHeaderFieldWithValues';
import { Tag } from '../types';

const transactionalEmailMessage: Tag = {
  tag: {
    name: 'transactional',
    reachable: REACHABILITY.NONE
  },
  rules: [
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
          'x-msfbl',
          'x-netsuite',
          'x-sg-eid'
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
        new HasHeaderWithValues('x-spam-flag', ['true']),
        new HasHeaderWithValues('X-AMAZON-MAIL-RELAY-TYPE', ['notification'])
      ]
    }
  ]
};

export default transactionalEmailMessage;
