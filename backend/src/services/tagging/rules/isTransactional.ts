import { hasHeaderFieldStartsWith, hasHeaderWithValue } from '../../../utils/helpers/emailMessageHelpers';
import { EmailMessageContent, TaggingCondition } from '../types';

export class IdentifyTransactionalTagRules implements TaggingCondition {
    checkCondition({ header }: EmailMessageContent) {
  
      const hasToMeetSomeConditions = [
        hasHeaderFieldStartsWith(header, [
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
          'x-netsuite'
        ]),
        hasHeaderWithValue(header, 'x-mailer', [
          'ec-messenger',
          'nlserver',
          'mailchimp',
          'nodemailer'
        ]),
        hasHeaderWithValue(header, 'auto-submitted', ['auto-generated']),
        hasHeaderWithValue(header, 'x-gnd-status', [
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
        hasHeaderWithValue(header, 'x-spam-flag', ['true'])
      ].some((c) => c === true)
      
      return hasToMeetSomeConditions
  
    }
  }