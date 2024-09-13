const EMAIL_PATTERN =
  /^(?=[a-zA-Z0-9@._%+-]{6,254}$)[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,8}[a-zA-Z]{2,63}$/;

export const isInvalidEmail = (email: string) =>
  Boolean(email) && !EMAIL_PATTERN.test(email);
