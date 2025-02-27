export const PASSWORD_MIN_LENGTH = 12;

export const SPECIAL_CHARACTERS = '!"#$%&\'()*+,-./;<=>?@[]^_`{|}~';

export const SPECIAL_CHAR_PATTERN = new RegExp(
  `[${SPECIAL_CHARACTERS.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`,
);

export const STRONG_PASSWORD_REGEX = new RegExp(
  `^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[${SPECIAL_CHARACTERS.replace(
    /[-[\]{}()*+?.,\\^$|#\s]/g,
    '\\$&',
  )}]).{${PASSWORD_MIN_LENGTH},}$`,
);

export const hasLowerCase = (password: string) =>
  Boolean(password) && /.*[a-z]+.*/g.test(password);

export const hasUpperCase = (password: string) =>
  Boolean(password) && /.*[A-Z]+.*/g.test(password);

export const hasNumber = (password: string) =>
  Boolean(password) && /.*[0-9]+.*/g.test(password);

export const hasSpecialChar = (password: string) =>
  Boolean(password) && SPECIAL_CHAR_PATTERN.test(password);

export const hasMinLength = (password: string) =>
  Boolean(password) && password.length >= PASSWORD_MIN_LENGTH;

export const isInvalidPassword = (password: string) =>
  !STRONG_PASSWORD_REGEX.test(password);
