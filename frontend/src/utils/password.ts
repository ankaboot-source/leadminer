export const PASSWORD_MIN_LENGTH = 12;

export const SPECIAL_CHARACTERS = '!"#$%&\'()*+,-./;<=>?@[]^_`{|}~';

export const SPECIAL_CHAR_PATTERN = new RegExp(
  `[${SPECIAL_CHARACTERS.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`,
);

export const hasLowerCase = (password: string) =>
  Boolean(password) && /.*[a-z]+.*/g.test(password);

export const hasUpperCase = (password: string) =>
  Boolean(password) && /.*[A-Z]+.*/g.test(password);

export const hasNumber = (password: string) =>
  Boolean(password) && /.*[0-9]+.*/g.test(password);

export const hasSpecialChar = (password: string) =>
  Boolean(password) && SPECIAL_CHAR_PATTERN.test(password);

export const isInvalidPassword = (password: string) =>
  (Boolean(password) &&
    hasLowerCase(password) &&
    hasUpperCase(password) &&
    hasNumber(password) &&
    hasSpecialChar(password)) === false;
