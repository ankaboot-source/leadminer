export const PASSWORD_PATTERN =
  /^(((?=.*[a-z])(?=.*[A-Z]))|((?=.*[a-z])(?=.*[0-9]))|((?=.*[A-Z])(?=.*[0-9])))(?=.{6,})/g;

export const isInvalidPassword = (password: string) =>
  Boolean(password) && !PASSWORD_PATTERN.test(password);

export const hasLowerCase = (password: string) =>
  Boolean(password) && /.*[a-z]+.*/g.test(password);

export const hasUpperCase = (password: string) =>
  Boolean(password) && /.*[A-Z]+.*/g.test(password);

export const hasNumber = (password: string) =>
  Boolean(password) && /.*[0-9]+.*/g.test(password);
