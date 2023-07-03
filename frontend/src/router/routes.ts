import DashboardPage from "src/pages/DashboardPage.vue";
import LoginPage from "src/pages/LoginPage.vue";
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

  // Always leave this as last one,
  // but you can also remove it
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/ErrorNotFound.vue"),
  },
];

export default routes;
