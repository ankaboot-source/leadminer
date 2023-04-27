import { hasHeaderWithValue } from '../../../utils/helpers/emailMessageHelpers';

export default class HasHeaderWithValues {
  constructor(field, values) {
    this.field = field;
    this.values = values;
  }

  checkRule({ header }) {
    return hasHeaderWithValue(header, this.field, this.values);
  }
}
