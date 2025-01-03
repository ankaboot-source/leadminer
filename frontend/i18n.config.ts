// skipcq: SCT-A000
export default defineI18nConfig(() => ({
  locale: 'en',
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      common: {
        welcome_back: 'Welcome back!',
        and: 'and',
        or: 'or',
        by: 'by',
        with: 'with',
        back: 'Back',
        to: 'to',
        create: 'Create',
        your: 'your',
        account: 'account',
        cancel: 'Cancel',
        mine: 'Mine',
        clean: 'Clean',
        enrich: 'Enrich',
        edit: 'Edit',
        start_mining: 'Start mining',
        read_privacy_policy:
          'Read our Data Privacy Policy for more information',
        support_assistance:
          'For any questions or assistance, our support team is here to help at',
        mailbox: 'mailbox',
        save: 'Save',
        the_plural: 'the',
        of: 'of',
        email_required: 'Email is required',
        password_required: 'Password is required',
      },
      auth: {
        sign_in: 'Sign in',
        sign_out: 'Sign out',
        sign_up: 'Sign up',
        no_account: "Don't have an account?",
        forgot_password: 'Forgot your password?',
        legal_information: 'Legal information',
        enter_associated_email:
          'Enter the email address associated with your account',
        valid_password: 'Please enter a valid password',
        password: 'Password',
        pick_password: 'Pick a password',
        suggestions: 'Suggestions',
        suggestion_lowercase: 'At least one lowercase',
        suggestion_uppercase: 'At least one uppercase',
        suggestion_numeric: 'At least one numeric',
        suggestion_special_character:
          'At least one special character {characters}',
        suggestion_min_chars: 'Minimum {n} characters',
        suggestion_weak_label: 'Weak',
        suggestion_medium_label: 'Medium',
        suggestion_strong_label: 'Strong',
        valid_email: 'Please enter a valid email',
        sign_in_failed: 'Sign in Failed',
        invalid_login: 'Invalid email or password',
        weak_password: 'Weak password, verify length or character criteria.',
        sign_up_success: 'Sign up Successfully',
        confirmation_email: 'We have sent a confirmation email to {email}',
        sign_up_failed: 'Sign up Failed',
        account_already: 'Already have an account?',
        discover_gems: 'Discover hidden gems in your social network',
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
        continue_with: 'Continue with {provider}',
        or_sign_in_with_social: 'or sign-in by social login',
        or_sign_up_with_social: 'or sign-up by social login',
        user_exist: 'User already registered',
      },
      email_template: {
        regards: 'Best regards,',
        footer:
          "You received this email because we received a request for your account. If you didn't request it, you can safely delete this email.",
      },
      time: {
        hour: '{n} hour | {n} hours',
        minute: '{n} minute | {n} minutes',
        second: '{n} second | {n} seconds',
      },
      contact: {
        name: 'Full name',
        given_name: 'Given Name',
        family_name: 'Family Name',
        alternate_name: 'Alternate Names',
        alternate_email: 'Alternate emails',
        location: 'Location',
        works_for: 'Works for',
        job_title: 'Job Title',
        same_as: 'Same As',
        image: 'Avatar',
        updated_at: 'Update date',
        created_at: 'Creation date',
        given_name_definition: 'The given name of this contact',
        family_name_definition: 'The family name of this contact',
        alternate_names_definition: 'Other names this contact goes by',
        alternate_emails_definition: 'Other emails this contact uses',
        address_definition: 'The location of this contact',
        works_for_definition: 'Organization this contact works for',
        job_title_definition: 'The job title of this contact',
        updated_at_definition: 'Last update date',
        created_at_definition: 'The creation date of this contact',
        status: {
          valid: 'VALID',
          risky: 'RISKY',
          invalid: 'INVALID',
          unknown: 'UNKNOWN',
          unverified: 'UNVERIFIED',
        },
        tag: {
          professional: 'Professional',
          newsletter: 'Newsletter',
          personal: 'Personal',
          group: 'Group',
          chat: 'Chat',
          role: 'Role',
        },
      },
    },
    fr: {
      common: {
        welcome_back: 'Bienvenue !',
        and: 'et',
        or: 'ou',
        by: 'par',
        with: 'avec',
        back: 'Retour',
        to: 'à',
        create: 'Créez',
        your: 'votre',
        account: 'compte',
        cancel: 'Annuler',
        mine: 'Extraire',
        clean: 'Nettoyer',
        enrich: 'Enrichir',
        edit: 'Modifier',
        start_mining: "Commencer l'extraction",
        read_privacy_policy:
          "Consultez notre Politique de Confidentialité des Données pour plus d'informations",
        support_assistance:
          'Pour toute question ou assistance, notre équipe de support est là pour vous aider à',
        mailbox: 'boîte aux lettres',
        save: 'Enregistrer',
        the_plural: 'les',
        of: 'sur',
        email_required: 'Email est obligatoire',
        password_required: 'Mot de passe est obligatoire',
      },
      auth: {
        sign_in: 'Se connecter',
        sign_out: 'Se déconnecter',
        sign_up: "S'inscrire",
        no_account: "Vous n'avez pas de compte ?",
        forgot_password: 'Mot de passe oublié ?',
        legal_information: 'Informations contractuelles',
        enter_associated_email:
          "Saisir l'adresse email associée à votre compte",
        valid_password: 'Veuillez entrer un mot de passe valide',
        password: 'Mot de passe',
        pick_password: 'Choisissez un mot de passe',
        suggestions: 'Suggestions',
        suggestion_lowercase: 'Au moins une minuscule',
        suggestion_uppercase: 'Au moins une majuscule',
        suggestion_numeric: 'Au moins un chiffre',
        suggestion_special_character:
          'Au moins un caractère spécial {characters}',
        suggestion_min_chars: 'Minimum {n} caractères',
        suggestion_weak_label: 'Faible',
        suggestion_medium_label: 'Moyen',
        suggestion_strong_label: 'Fort',
        valid_email: 'Veuillez entrer un e-mail valide',
        sign_in_failed: 'Échec de la connexion',
        invalid_login: 'Identifiant ou mot de passe invalide',
        weak_password:
          'Mot de passe faible, vérifiez la longueur ou les critères de caractères.',
        sign_up_success: 'Inscription réussie',
        confirmation_email:
          'Nous avons envoyé un e-mail de confirmation à {email}',
        sign_up_failed: "Échec de l'inscription",
        account_already: 'Vous avez déjà un compte ?',
        discover_gems: 'Découvrez des trésors cachés dans votre réseau social',
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
        continue_with: 'Continuer avec {provider}',
        or_sign_in_with_social: 'ou se connecter avec votre compte',
        or_sign_up_with_social: "ou s'inscrire avec votre compte",
        user_exist: 'Utilisateur déjà inscrit',
      },
      email_template: {
        regards: 'Cordialement,',
        footer:
          "Vous avez reçu cet e-mail parce que nous avons reçu une demande concernant votre compte. Si vous ne l'avez pas demandé, vous pouvez supprimer cet e-mail en toute sécurité.",
      },
      time: {
        hour: '{n} heure | {n} heures',
        minute: '{n} minute | {n} minutes',
        second: '{n} seconde | {n} secondes',
      },
      contact: {
        name: 'Nom complet',
        given_name: 'Prénom',
        family_name: 'Nom de famille',
        alternate_name: 'Autres noms',
        alternate_email: 'Adresses e-mail alternatives',
        location: 'Localisation',
        works_for: 'Travaille pour',
        job_title: 'Titre du poste',
        same_as: 'Réseaux sociaux',
        image: 'Avatar',
        updated_at: 'Date de modification',
        created_at: 'Date de création',
        given_name_definition: 'Le prénom de ce contact',
        family_name_definition: 'Le nom de famille de ce contact',
        alternate_names_definition:
          'Autres noms par lesquels ce contact est connu',
        alternate_emails_definition:
          'Autres adresses e-mail utilisées par ce contact',
        address_definition: "L'emplacement de ce contact",
        works_for_definition: 'Organisation pour laquelle ce contact travaille',
        updated_at_definition: 'Dernière date de modification',
        created_at_definition: 'La date de création de ce contact',
        job_title_definition: 'Le titre du poste de ce contact',
        status: {
          valid: 'VALIDE',
          risky: 'RISQUÉ',
          invalid: 'INVALIDE',
          unknown: 'INCONNU',
          unverified: 'NON VÉRIFIÉ',
        },
        tag: {
          professional: 'Professionnel',
          newsletter: 'Newsletter',
          personal: 'Personnel',
          group: 'Groupe',
          chat: 'Chat',
          role: 'Role',
        },
      },
    },
  },
}));
