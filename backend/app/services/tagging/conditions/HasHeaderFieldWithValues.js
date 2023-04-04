const {
  hasHeaderWithValue
} = require('../../../utils/helpers/emailMessageHelpers');

class HasHeaderWithValues {
  constructor(field, values) {
    this.field = field;
    this.values = values;
  }

  checkRule({ header }) {
    return hasHeaderWithValue(header, this.field, this.values);
  }
}

module.exports = {
  HasHeaderWithValues
};
