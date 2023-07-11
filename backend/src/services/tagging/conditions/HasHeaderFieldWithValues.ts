import { hasHeaderWithValue } from '../../../utils/helpers/taggingHelpers';
import { EmailMessageContent, TaggingCondition } from '../types';

export default class HasHeaderWithValues implements TaggingCondition {
  private readonly field: string;

  private readonly values: string[];

  constructor(field: string, values: string[]) {
    this.field = field;
    this.values = values;
  }

  checkCondition({ header }: EmailMessageContent) {
    return hasHeaderWithValue(header, this.field, this.values);
  }
}
