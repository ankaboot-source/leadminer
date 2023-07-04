import DashboardPage from "src/pages/DashboardPage.vue";
import ForgotPasswordPage from "src/pages/ForgotPasswordPage.vue";
import LoginPage from "src/pages/LoginPage.vue";
import SignupPage from "src/pages/SignupPage.vue";
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
