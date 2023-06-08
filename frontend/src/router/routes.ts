import { LocalStorage } from "quasar";
import { RouteLocationNormalized, RouteRecordRaw } from "vue-router";

function authGuard(to: RouteLocationNormalized) {
  if (!LocalStorage.has("user") && !to.hash) {
    return "/";
  }
  return true;
}

const routes: RouteRecordRaw[] = [
  {
    path: "/dashboard",
    component: () => import("layouts/MainLayout.vue"),
    beforeEnter: authGuard,
    children: [
      { path: "", component: () => import("src/pages/DashboardPage.vue") },
    ],
  },
  {
    path: "/",
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
