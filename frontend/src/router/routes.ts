import { supabase } from "src/helpers/supabase";
import DashboardPage from "src/pages/DashboardPage.vue";
import AccountSettingsPage from "src/pages/account/AccountSettingsPage.vue";
import ForgotPasswordPage from "src/pages/auth/ForgotPasswordPage.vue";
import LoginPage from "src/pages/auth/LoginPage.vue";
import OAuthConsentErrorPage from "src/pages/auth/OAuthConsentErrorPage.vue";
import SignupPage from "src/pages/auth/SignupPage.vue";
import { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/dashboard",
    name: "Dashboard",
    component: DashboardPage,
    meta: {
      isAuthRequired: true,
    },
  },
  {
    path: "/oauth-consent-error",
    name: "OAuth Consent Error",
    component: OAuthConsentErrorPage,
    // eslint-disable-next-line consistent-return
    beforeEnter: async (to) => {
      const { data } = await supabase.auth.getSession();
      // We only allow authenticated users that initiated the OAuth Flow to access this page
      if (to.query.referrer !== data.session?.user.id) {
        return "/dashboard";
      }
    },
    meta: {
      isAuthRequired: true,
    },
  },
  {
    path: "/credits-success",
    name: "Landing post payment",
    component: () =>
      import("src/billing/pages/CreditsSuccess.vue").catch(() => DashboardPage),
    beforeEnter: async (_, __, next) => {
      try {
        await import("src/billing/pages/CreditsSuccess.vue");
      } catch (e) {
        next("/dashboard");
      }

      const params = new URLSearchParams(window.location.search);
      const subscription = params.get("is_subscription");
      const credits = parseInt(params.get("credits") ?? "");

      if (!subscription || !credits || Number.isNaN(credits)) {
        next("/dashboard");
      } else {
        next();
      }
    },
  },
  {
    path: "/account",
    name: "Update Password",
    component: AccountSettingsPage,
    meta: {
      isAuthRequired: true,
    },
  },
  {
    path: "/",
    component: LoginPage,
    name: "Login",
    meta: {
      isAuthRequired: false,
    },
  },
  {
    path: "/signup",
    component: SignupPage,
    name: "Signup",
    meta: {
      isAuthRequired: false,
    },
  },
  {
    path: "/forgot-password",
    component: ForgotPasswordPage,
    name: "Forgot Password",
    meta: {
      isAuthRequired: false,
    },
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/ErrorNotFound.vue"),
  },
];

export default routes;
