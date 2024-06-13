export default defineI18nConfig(() => ({
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      common: {
        welcome_back: 'Welcome back!',
        and: 'and',
        or: 'or',
        by: 'by',
        with: 'with',
        back: 'back',
        to: 'to',
        create: 'create',
        your: 'your',
        account: 'account',
      },
      auth: {
        sign_in: 'sign in',
        sign_out: 'sign out',
        sign_up: 'sign up',
        no_account: "Don't have an account?",
        forgot_password: 'Forgot your password?',
        agree_sign_in: 'By signing in, you agree to the',
        terms_of_service: 'Terms of Service',
        data_privacy_policy: 'Data Privacy Policy.',
        email_offers_agree:
          'You also agree to receive information and offers relevant to our services via email.',
        enter_associated_email:
          'Enter the email address associated with your account',
        valid_password: 'Please enter a valid password',
        password: 'password',
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
        account_already: 'Already have an account?',
        discover_gems: 'Discover hidden gems in your social network',
        sign_up_agree: 'By signing up, you agree to the',

        sign_up_success_header: 'Almost done',
        sign_up_success_message1: 'We sent an email to',
        sign_up_success_message2:
          "It is a link that will sign you up. If you can't see this email, please check your spam folder.",
        social_account: 'social account',
        send_reset_instructions: 'Send reset instructions',
        reset_password_confirmed: 'Reset Password Confirmed',
        reset_password_failed: 'Reset Password Failed',
        reset_instructions_sent:
          'If an account exists with this email address, you will receive password reset instructions',

        continue_with: 'continue with {provider}',
      },
    },
    fr: {
      common: {
        welcome_back: 'Bienvenue!',
        and: 'et',
        or: 'ou',
        by: 'par',
        with: 'avec',
        back: 'retour',
        to: 'à',
        create: 'créez',
        your: 'votre',
        account: 'compte',
        continue_with: 'continuer avec {provider}',
      },
      auth: {
        sign_in: 'se connecter',
        sign_out: 'se déconnecter',
        sign_up: "s'inscrire",
        no_account: "Vous n'avez pas de compte?",
        forgot_password: 'Mot de passe oublié?',
        agree_sign_in: 'En vous connectant, vous acceptez les',
        terms_of_service: "Conditions d'utilisation",
        data_privacy_policy: 'Politique de confidentialité.',
        email_offers_agree:
          'Vous acceptez également de recevoir des informations et des offres pertinentes pour nos services par e-mail.',
        enter_associated_email:
          'Enter the email address associated with your account',
        valid_password: 'Veuillez entrer un mot de passe valide',
        password: 'mot de passe',
        pick_password: 'Choisissez un mot de passe',
        suggestions: 'Suggestions',
        suggestion_lowercase: 'Au moins une minuscule',
        suggestion_uppercase: 'Au moins une majuscule',
        suggestion_numeric: 'Au moins un chiffre',
        suggestion_min_chars: 'Minimum 8 caractères',
        valid_email: 'Veuillez entrer un e-mail valide',
        sign_in_failed: 'Échec de la connexion',
        invalid_login: 'Identifiant ou mot de passe invalide',
        sign_up_success: 'Inscription réussie',
        confirmation_email:
          'Nous avons envoyé un e-mail de confirmation à {email}',
        sign_up_failed: "Échec de l'inscription",
        account_already: 'Vous avez déjà un compte?',
        discover_gems: 'Découvrez des trésors cachés dans votre réseau social',
        sign_up_agree: 'En vous inscrivant, vous acceptez les',
        sign_up_success_header: 'Presque terminé',
        sign_up_success_message1: 'Nous avons envoyé un e-mail à',
        sign_up_success_message2:
          'Il contient un lien qui vous inscrira. Si vous ne voyez pas cet e-mail, veuillez vérifier votre dossier de spam.',
        social_account: 'compte social',
        send_reset_instructions: 'Envoyer les instructions de réinitialisation',
        reset_password_confirmed: 'Réinitialisation du mot de passe confirmée',
        reset_password_failed: 'Échec de la réinitialisation du mot de passe',
        reset_instructions_sent:
          'Si un compte existe avec cette adresse e-mail, vous recevrez des instructions de réinitialisation du mot de passe',
        continue_with: 'continuer avec {provider}',
      },
    },
  },
}));
