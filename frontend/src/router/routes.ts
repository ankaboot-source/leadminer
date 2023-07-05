import DashboardPage from "src/pages/DashboardPage.vue";
import AccountSettingsPage from "src/pages/account/AccountSettingsPage.vue";
import ForgotPasswordPage from "src/pages/auth/ForgotPasswordPage.vue";
import LoginPage from "src/pages/auth/LoginPage.vue";
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
