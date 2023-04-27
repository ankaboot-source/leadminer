import { hasHeaderFieldStartsWith } from '../../../utils/helpers/emailMessageHelpers';

export default class HasHeaderFieldStartsWith {
  constructor(possibleHeaderPrefixes) {
    this.possibleHeaderPrefixes = possibleHeaderPrefixes;
  }

  checkRule({ header }) {
    return hasHeaderFieldStartsWith(header, this.possibleHeaderPrefixes);
  }
}
