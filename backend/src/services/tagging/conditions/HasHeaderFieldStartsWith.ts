import { hasHeaderFieldStartsWith } from '../../../utils/helpers/emailMessageHelpers';
import { EmailMessageContent, TaggingCondition } from '../types';

export default class HasHeaderFieldStartsWith implements TaggingCondition {
  private readonly possibleHeaderPrefixes: string[];

  constructor(possibleHeaderPrefixes: string[]) {
    this.possibleHeaderPrefixes = possibleHeaderPrefixes;
  }

  checkCondition({ header }: EmailMessageContent) {
    return hasHeaderFieldStartsWith(header, this.possibleHeaderPrefixes);
  }
}
