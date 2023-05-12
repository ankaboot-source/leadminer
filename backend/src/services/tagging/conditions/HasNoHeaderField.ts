import { getSpecificHeader } from '../../../utils/helpers/emailMessageHelpers';
import { EmailMessageContent, TaggingCondition } from '../types';

export default class HasNoHeaderField implements TaggingCondition {
  private readonly possibleHeaderFields: string[];

  constructor(possibleHeaderFields: string[]) {
    this.possibleHeaderFields = possibleHeaderFields;
  }

  checkCondition({ header }: EmailMessageContent) {
    return getSpecificHeader(header, this.possibleHeaderFields) === null;
  }
}
