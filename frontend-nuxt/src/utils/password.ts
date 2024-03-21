export const PASSWORD_PATTERN =
  /^(((?=.*[a-z])(?=.*[A-Z]))|((?=.*[a-z])(?=.*[0-9]))|((?=.*[A-Z])(?=.*[0-9])))(?=.{6,})/g;

export const isValidPassword = (password: string) =>
  PASSWORD_PATTERN.test(password);

export const passwordRules = [
  (val: string) => val.length >= 8 || 'Please use at least 8 characters',
];
