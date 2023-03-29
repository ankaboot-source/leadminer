const {
  hasHeaderFieldStartsWith,
  getSpecificHeader,
  hasHeaderWithValue
} = require('../../utils/helpers/emailMessageHelpers');

class HasHeaderFieldStartsWith {
  constructor(possibleHeaderPrefixes) {
    this.possibleHeaderPrefixes = possibleHeaderPrefixes;
  }

  checkRule({ header }) {
    return hasHeaderFieldStartsWith(header, this.possibleHeaderPrefixes);
  }
}

class HasSpecificHeaderField {
  constructor(possibleHeaderFields) {
    this.possibleHeaderFields = possibleHeaderFields;
  }

  checkRule({ header }) {
    return getSpecificHeader(header, this.possibleHeaderFields) !== null;
  }
}

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
  HasHeaderFieldStartsWith,
  HasHeaderWithValues,
  HasSpecificHeaderField
};
