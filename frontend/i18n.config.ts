export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      common: {
        welcome: 'Welcome back!',
        and: 'and',
      },
      auth: {
        sign_in: 'Sign in',
        sign_out: 'Sign out',
        sign_up: 'Sign up',
        no_account: "Don't have an account?",
        forgot_password: 'Forgot your password?',
        agree_sign_in: 'By signing in, you agree to the',
        terms_of_service: 'Terms of Service',
        data_privacy_policy: 'Data Privacy Policy',
        email_offers:
          'You also agree to receive information and offers relevant to our services via email',
        valid_password: 'Please enter a valid password',
        password: 'Password',
        pick_password: 'Pick a password',
        suggestions: 'Suggestions',
        suggestion_lowercase: 'At least one lowercase',
        suggestion_uppercase: 'At least one uppercase',
        suggestion_numeric: 'At least one numeric',
        suggestion_min_chars: 'Minimum 8 characters',
        valid_email: 'Please enter a valid email',
        sign_in_failed: 'Sign in Failed',
        invalid_login: 'Invalid login or password',
        sign_up_success: 'Sign up Successfully',
        confirmation_email: 'We have sent a confirmation email to {email}',
        sign_up_failed: 'Sign up Failed',
        account_create: 'Create your account',
        account_already: 'Already have an account?',
        discover_gems: 'Discover hidden gems in your social network',
        sign_up_agree: 'By signing up, you agree to the',
        email_offers_agree:
          'You also agree to receive information and offers relevant to our services via email.',
        sign_up_success_header: 'Almost done',
        sign_up_success_message1: 'We sent an email to',
        sign_up_success_message2:
          "It is a link that will sign you up. If you can't see this email, please check your spam folder.",
      },
    },
    fr: {
      common: {
        welcome: 'Bienvenue!',
        and: 'et',
      },
    },
  },
}));
