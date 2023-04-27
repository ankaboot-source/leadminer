import { getSpecificHeader } from '../../../utils/helpers/emailMessageHelpers';

export default class HasHeaderField {
  constructor(possibleHeaderFields) {
    this.possibleHeaderFields = possibleHeaderFields;
  }

  checkRule({ header }) {
    return getSpecificHeader(header, this.possibleHeaderFields) !== null;
  }
}
