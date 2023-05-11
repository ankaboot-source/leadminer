import { hasHeaderWithValue } from '../../../utils/helpers/emailMessageHelpers';
import { EmailMessageContent, TaggingCondition } from '../types';

export default class HasHeaderWithValues implements TaggingCondition {
  private field: string;

  private values: string[];

  constructor(field: string, values: string[]) {
    this.field = field;
    this.values = values;
  }

  checkCondition({ header }: EmailMessageContent) {
    return hasHeaderWithValue(header, this.field, this.values);
  }
}
