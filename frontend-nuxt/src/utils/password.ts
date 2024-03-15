export const passwordRules = [
  (val: string) => val.length >= 8 || 'Please use at least 8 characters',
];
