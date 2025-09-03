type EmailTemplate = {
  Prehead: string;
  Title: string;
  Body1: string;
  Body2: string;
  Body3?: string;
  Body4?: string;
  Button: string;
  Regards: string;
  Footer: string;
};

type EmailTemplatesI18n = {
  Invite: EmailTemplate;
  Confirmation: EmailTemplate;
  Recovery: EmailTemplate;
  EmailChange: EmailTemplate;
};

type LanguageEmailTemplates = Map<string, EmailTemplatesI18n>;

const supabaseEmailsI18n: LanguageEmailTemplates = new Map([
  [
    "en",
    {
      Invite: {
        Prehead: "Invitation to leadminer",
        Title: "You're Invited to Join",
        Body1: "You're invited to join ",
        Body2:
          "! We're excited to have you as part of our community. With our platform, you can effortlessly generate clean and enriched contacts directly from your mailbox. To get started, click the button below to accept the invitation and create your account.",
        Button: "Accept Invitation",
        Regards: "Best regards,",
        Footer:
          "You received this email because we received a request for your account. If you didn't request it, you can safely delete this email.",
      },
      Confirmation: {
        Prehead: "Confirm your signup to leadminer",
        Title: "Confirm Your Email Address",
        Body1: "Welcome to ",
        Body2:
          "! We're happy that you've selected us to help you generate clean and enriched contacts from your mailbox. Click the button below to confirm your email address and activate your account.",
        Body3: "If you didn't sign up with ",
        Body4: ", you can safely disregard this email.",
        Button: "Confirm your email",
        Regards: "Best regards,",
        Footer:
          "You received this email because we received a request for your account. If you didn't request it, you can safely delete this email.",
      },
      Recovery: {
        Prehead: " Reset Your Password",
        Title: " Reset Your Password",
        Body1: "Tap the button below to reset your",
        Body2:
          "account password. If you didn't request a new password, you can safely delete this email.",
        Button: "Confirm your email",
        Regards: "Best regards,",
        Footer:
          "You received this email because we received a request for your account. If you didn't request it, you can safely delete this email.",
      },
      EmailChange: {
        Prehead: "Confirm your email change",
        Title: "Confirm your email change",
        Body1: "Welcome to ",
        Body2:
          "! We're happy to assist you with keeping your account information up to date. You recently requested to change the email address associated with your ",
        Body3:
          " account. Please click the button below to confirm your new email address and complete the update.",
        Body4:
          "If you didn't request this change, you can safely disregard this email. Your current email address will remain unchanged.",
        Button: "Confirm Email Address",
        Regards: "Best regards,",
        Footer:
          "You received this email because we received a request for your account. If you didn't request it, you can safely delete this email.",
      },
    },
  ],
  [
    "fr",
    {
      Invite: {
        Prehead: "Invitation à leadminer",
        Title: "Vous êtes invité à rejoindre",
        Body1: "Vous êtes invité à rejoindre ",
        Body2:
          "! Nous sommes ravis de vous accueillir dans notre communauté. Avec notre plateforme, vous pouvez générer facilement des contacts propres et enrichis directement depuis votre boîte mail. Pour commencer, cliquez sur le bouton ci-dessous pour accepter l'invitation et créer votre compte.",
        Button: "Accepter l'invitation",
        Regards: "Cordialement,",
        Footer:
          "Vous avez reçu cet e-mail car nous avons reçu une demande pour votre compte. Si vous n'avez pas fait cette demande, vous pouvez supprimer cet e-mail en toute sécurité.",
      },
      Confirmation: {
        Prehead: "Confirmez votre inscription à leadminer",
        Title: "Confirmez votre adresse e-mail",
        Body1: "Bienvenue à ",
        Body2:
          "! Nous sommes heureux que vous nous ayez choisis pour vous aider à générer des contacts propres et enrichis à partir de votre boîte aux lettres. Cliquez sur le bouton ci-dessous pour confirmer votre adresse e-mail et activer votre compte.",
        Body3: "Si vous ne vous êtes pas inscrit auprès de ",
        Body4: ", vous pouvez ignorer cet e-mail en toute sécurité.",
        Button: "Confirmez votre e-mail",
        Regards: "Cordialement,",
        Footer:
          "Vous avez reçu cet e-mail parce que nous avons reçu une demande concernant votre compte. Si vous ne l'avez pas demandé, vous pouvez supprimer cet e-mail en toute sécurité.",
      },
      Recovery: {
        Prehead: "Réinitialisez votre mot de passe",
        Title: "Réinitialisez votre mot de passe",
        Body1:
          "Appuyez sur le bouton ci-dessous pour réinitialiser le mot de passe de votre compte",
        Body2:
          "Si vous n'avez pas demandé un nouveau mot de passe, vous pouvez supprimer cet e-mail en toute sécurité.",
        Button: "Confirmez votre e-mail",
        Regards: "Cordialement,",
        Footer:
          "Vous avez reçu cet e-mail car nous avons reçu une demande pour votre compte. Si vous n'avez pas fait cette demande, vous pouvez supprimer cet e-mail en toute sécurité.",
      },
      EmailChange: {
        Prehead: "Confirmez votre changement d'adresse e-mail",
        Title: "Confirmez votre changement d'adresse e-mail",
        Body1: "Bienvenue à ",
        Body2:
          "! Nous sommes heureux de vous aider à mettre à jour les informations relatives à votre compte. Vous avez récemment demandé à changer l'adresse e-mail associée à votre compte ",
        Body3:
          ". Veuillez cliquer sur le bouton ci-dessous pour confirmer votre nouvelle adresse e-mail et terminer la mise à jour.",
        Body4:
          "Si vous n'avez pas demandé ce changement, vous pouvez ignorer cet e-mail. Votre adresse e-mail actuelle restera inchangée.",
        Button: "Confirmez votre adresse e-mail",
        Regards: "Cordialement,",
        Footer:
          "Vous avez reçu cet e-mail parce que nous avons reçu une demande concernant votre compte. Si vous ne l'avez pas demandé, vous pouvez supprimer cet e-mail en toute sécurité.",
      },
    },
  ],
]);

export default supabaseEmailsI18n;
