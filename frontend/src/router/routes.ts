import {
  isAuthenticatedUserOrLogout,
  isAnonymousUserOrRedirect,
} from "src/helpers/auth";
import { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/dashboard",
    component: () => import("layouts/MainLayout.vue"),
    beforeEnter: (to) => isAuthenticatedUserOrLogout(to, "/"),
    children: [
      { path: "", component: () => import("src/pages/DashboardPage.vue") },
    ],
  },
  {
    path: "/",
    beforeEnter: () => isAnonymousUserOrRedirect("/dashboard"),
    component: () => import("src/pages/LoginPage.vue"),
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/ErrorNotFound.vue"),
  },
];

export default routes;
