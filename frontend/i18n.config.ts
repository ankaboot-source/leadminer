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
        back: 'back',
        to: 'to',
        create: 'create',
        your: 'your',
        account: 'account',
        cancel: 'cancel',
        extract: 'extract',
        clean: 'clean',
        enrich: 'enrich',
        start_mining: 'Start mining',
        read_privacy_policy:
          'Read our Data Privacy Policy for more information',
        support_assistance:
          'For any questions or assistance, our support team is here to help at',
        mailbox: 'mailbox',
        save: 'save',
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
      email_template: {
        "change_email": {
          "prehead": "Confirm your email change",
          "title": "Confirm Your Email Change",
          "body": {
            "p1": "Welcome to ",
            "p2": "! We're happy to assist you with keeping your account information up to date. You recently requested to change the email address associated with your ",
            "p3": " account. Please click the button below to confirm your new email address and complete the update.",
            "p4": "If you didn't request this change, you can safely disregard this email. Your current email address will remain unchanged."
          },
          "button": "Confirm Email Address",
        },
        "email_confirmation": {
          "prehead": "Confirm your signup to leadminer",
          "title": "Confirm Your Email Address",
          "body": {
            "p1": "Welcome to ",
            "p2": "! We're happy that you've selected us to help you generate clean and enriched contacts from your mailbox. Click the button below to confirm your email address and activate your account.",
            "p3": "If you didn't sign up with ",
            "p4": ", you can safely disregard this email."
          },
          "button": "Confirm your email"
        },
        "reset_password": {
          "prehead": "Reset your leadminer password",
          "title": "Reset Your Password",
          "body": {
            "p1": "Tap the button below to reset your ",
            "p2": "account password. If you didn't request a new password, you can safely delete this email."
          },
          "button": "Reset your password"
        },
        "email_invite": {
          "prehead": "Invitation to leadminer",
          "title": "You're Invited to Join",
          "body": {
            "p1": "You're invited to join ",
            "p2": "! We're excited to have you as part of our community. With our platform, you can effortlessly generate clean and enriched contacts directly from your mailbox. To get started, click the button below to accept the invitation and create your account.",
            "p3": "If you did not expect this invitation from ",
            "p4": ", you can safely disregard this email."
          },
          "button": "Accept Invitation"
        },
        "regards": "Best regards,",
        "footer": "You received this email because we received a request for registration for your account. If you didn't request registration you can safely delete this email."
      }
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
        cancel: 'annuler',
        extract: 'extraire',
        clean: 'nettoyer',
        enrich: 'enrichir',
        start_mining: "Commencer l'extraction",
        read_privacy_policy:
          "Consultez notre Politique de Confidentialité des Données pour plus d'informations",
        support_assistance:
          'Pour toute question ou assistance, notre équipe de support est là pour vous aider à',
        mailbox: 'boîte aux lettres',
        save: 'sauvegarder',
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
      email_template: {
        "change_email": {
          "prehead": "Confirmez votre changement d'adresse e-mail",
          "title": "Confirmez votre changement d'adresse e-mail",
          "body": {
            "p1": "Bienvenue à ",
            "p2": "! Nous sommes heureux de vous aider à mettre à jour les informations relatives à votre compte. Vous avez récemment demandé à changer l'adresse e-mail associée à votre ",
            "p3": " compte. Veuillez cliquer sur le bouton ci-dessous pour confirmer votre nouvelle adresse e-mail et terminer la mise à jour.",
            "p4": "Si vous n'avez pas demandé ce changement, vous pouvez ignorer cet e-mail. Votre adresse e-mail actuelle restera inchangée."
          },
          "button": "Confirmez votre adresse e-mail",
        },
        "email_confirmation": {
          "prehead": "Confirmez votre inscription à leadminer",
          "title": "Confirmez votre adresse e-mail",
          "body": {
            "p1": "Bienvenue à ",
            "p2": "! Nous sommes heureux que vous nous ayez choisis pour vous aider à générer des contacts propres et enrichis à partir de votre boîte aux lettres. Cliquez sur le bouton ci-dessous pour confirmer votre adresse e-mail et activer votre compte.",
            "p3": "Si vous ne vous êtes pas inscrit auprès de ",
            "p4": ", vous pouvez ignorer cet e-mail en toute sécurité."
          },
          "button": "Confirmez votre e-mail"
        },
        "reset_password": {
          "prehead": "Réinitialiser votre mot de passe leadminer",
          "title": "Réinitialiser votre mot de passe",
          "body": {
            "p1": "Appuyez sur le bouton ci-dessous pour réinitialiser votre ",
            "p2": "mot de passe de votre compte. Si vous n'avez pas demandé de nouveau mot de passe, vous pouvez supprimer cet e-mail en toute sécurité."
          },
          "button": "Réinitialiser votre mot de passe"
        },
        "email_invite": {
          "prehead": "Invitation à leadminer",
          "title": "Vous êtes invité à rejoindre",
          "body": {
            "p1": "Vous êtes invités à rejoindre ",
            "p2": "! Nous sommes ravis que vous fassiez partie de notre communauté. Grâce à notre plateforme, vous pouvez générer sans effort des contacts propres et enrichis directement à partir de votre boîte aux lettres. Pour commencer, cliquez sur le bouton ci-dessous pour accepter l'invitation et créer votre compte.",
            "p3": "Si vous n'attendiez pas cette invitation de la part de ",
            "p4": ", vous pouvez ignorer cet e-mail en toute sécurité."
          },
          "button": "Accepter l'invitation"
        },
        "regards": "Cordialement,",
        "footer": "Vous avez reçu cet e-mail parce que nous avons reçu une demande d'enregistrement pour votre compte. Si vous n'avez pas demandé d'enregistrement, vous pouvez supprimer cet e-mail en toute sécurité."
      }
    },
  },
}));
