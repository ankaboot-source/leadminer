export const REGEX_EMAIL =
  /^\b[A-Z0-9!#$%&'*+-/=?^_`{|}~.]{1,64}@[A-Z0-9.-]{0,66}\.[A-Z]{2,18}\b$/i;

export const isInvalidEmail = (email: string) =>
  Boolean(email) && !REGEX_EMAIL.test(email);
