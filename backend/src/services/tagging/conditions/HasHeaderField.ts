import { getSpecificHeader } from '../../../utils/helpers/emailHeaderHelpers';
import { EmailMessageContent, TaggingCondition } from '../types';

export default class HasHeaderField implements TaggingCondition {
  private readonly possibleHeaderFields: string[];

  constructor(possibleHeaderFields: string[]) {
    this.possibleHeaderFields = possibleHeaderFields;
  }

  checkCondition({ header }: EmailMessageContent) {
    return getSpecificHeader(header, this.possibleHeaderFields) !== null;
  }
}
