export const PASSWORD_PATTERN =
  /^(((?=.*[a-z])(?=.*[A-Z]))|((?=.*[a-z])(?=.*[0-9]))|((?=.*[A-Z])(?=.*[0-9])))(?=.{6,})/g; // PrimeVue's password mediumRegex

export const isInvalidPassword = (password: string) =>
  Boolean(password) && !PASSWORD_PATTERN.test(password);
