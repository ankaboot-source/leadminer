const routes = [
  {
    path: "/dashboard",
    component: () => import("layouts/MainLayout.vue"),
    children: [{ path: "", component: () => import("pages/Dashboard.vue") }],
  },
  {
    path: "/",
    component: () => import("pages/Login-1.vue"),
  },
];

export default routes;
