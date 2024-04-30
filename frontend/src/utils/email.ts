const EMAIL_PATTERN =
  /^(?=[a-zA-Z0-9@._%+-]{6,254}$)[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,8}[a-zA-Z]{2,63}$/;

export const isValidEmailPattern = (email: string) => EMAIL_PATTERN.test(email);
export const isInvalidEmailPattern = (email: string) =>
  !EMAIL_PATTERN.test(email);
