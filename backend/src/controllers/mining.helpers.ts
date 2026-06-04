import { ContactFormat } from '../services/extractors/engines/FileImport';

const REGEX_EMAIL = /^\b[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{0,66}\.[A-Z]{2,18}\b$/i;
const isInvalidEmail = (email?: string) =>
  email ? !REGEX_EMAIL.test(email) : false;
function isValidURL(url: string) {
  try {
    // skipcq: JS-R1002 - instantiating unused object as the url validity checker
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates the contacts data with throwing an error if the data is invalid.
 * @param contacts The contacts data extracted from a file.
 */
// eslint-disable-next-line import/prefer-default-export
export function validateFileContactsData(
  contacts: Partial<ContactFormat[]>
): void {
  if (!contacts.length) {
    throw new Error('No contacts found in the in the contacts data');
  }
  contacts.forEach((contact) => {
    if (!contact) {
      throw new Error('Empty contact found in the contacts data');
    }

    if (isInvalidEmail(contact.email)) {
      throw new Error('Invalid email found in the contacts data');
    }

    const URL_LIST = [contact.image?.split(','), contact.same_as?.split(',')]
      .map((list) => list?.map((url) => url.trim()).filter(Boolean))
      .filter((list) => list?.length);
    URL_LIST.forEach((list) => {
      if (list?.length && !list.every((url) => isValidURL(url))) {
        throw new Error('Invalid URL found in the contacts data');
      }
    });
  });
}
