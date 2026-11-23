import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { agencyRegistrationEnabled } from "../config";

const routes = [
  {
    path: "/login",
    name: "login",
    component: () => import("../views/auth/Login.vue"),
  },
  {
    path: "/register",
    name: "register",
    component: () => import("../views/auth/Register.vue"),
  },
  {
    path: "/forgot-password",
    name: "forgotPassword",
    component: () => import("../views/auth/ForgotPassword.vue"),
  },
  {
    path: "/reset-password",
    name: "resetPassword",
    component: () => import("../views/auth/ResetPassword.vue"),
  },
  {
    path: "/register-agency",
    name: "registerAgency",
    component: () => import("../views/auth/RegisterAgency.vue"),
  },
  {
    path: "/",
    component: () => import("../views/dashboard/Layout.vue"),
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        name: "overview",
        component: () => import("../views/dashboard/Overview.vue"),
      },
      {
        path: "devices",
        name: "devices",
        component: () => import("../views/dashboard/Devices.vue"),
      },
      {
        path: "groups",
        name: "groups",
        component: () => import("../views/dashboard/Groups.vue"),
      },
      {
        path: "api-keys",
        name: "apiKeys",
        component: () => import("../views/dashboard/ApiKeys.vue"),
      },
      {
        path: "webhooks",
        name: "webhooks",
        component: () => import("../views/dashboard/Webhooks.vue"),
      },
      {
        path: "webhooks/add",
        name: "webhookAdd",
        component: () => import("../views/dashboard/WebhookAdd.vue"),
      },
      {
        path: "webhook-logs",
        name: "webhookLogs",
        component: () => import("../views/dashboard/WebhookLogs.vue"),
      },
      {
        path: "integrations",
        name: "integrations",
        component: () => import("../views/dashboard/Integrations.vue"),
      },
      {
        path: "integrations/google-form",
        name: "integrationGoogleForm",
        component: () => import("../views/dashboard/GoogleFormIntegration.vue"),
      },
      {
        path: "integrations/google-spreadsheet",
        name: "integrationGoogleSpreadsheet",
        component: () => import("../views/dashboard/GoogleSpreadsheetIntegration.vue"),
      },
      {
        path: "api-docs",
        name: "apiDocs",
        component: () => import("../views/dashboard/ApiDocumentation.vue"),
      },
      {
        path: "auto-reply",
        name: "autoReply",
        component: () => import("../views/dashboard/AutoReply.vue"),
      },
      {
        path: "auto-reply/add",
        name: "autoReplyAdd",
        component: () => import("../views/dashboard/AutoReplyAdd.vue"),
      },
      {
        path: "contact-lists",
        name: "contactLists",
        component: () => import("../views/dashboard/ContactLists.vue"),
      },
      {
        path: "contact-lists/:id",
        name: "contactListDetail",
        component: () => import("../views/dashboard/ContactListDetail.vue"),
      },
      {
        path: "broadcasts",
        name: "broadcasts",
        component: () => import("../views/dashboard/Broadcasts.vue"),
      },
      {
        path: "broadcasts/:id",
        name: "broadcastDetail",
        component: () => import("../views/dashboard/BroadcastDetail.vue"),
      },
      {
        path: "logs",
        name: "logs",
        component: () => import("../views/dashboard/Logs.vue"),
      },
      {
        path: "profile",
        name: "profile",
        component: () => import("../views/dashboard/Profile.vue"),
      },
      {
        path: "billing",
        name: "billing",
        component: () => import("../views/billing/Billing.vue"),
      },
      {
        path: "billing/payment/:orderId",
        name: "paymentInstruction",
        component: () => import("../views/billing/PaymentInstruction.vue"),
      },
      {
        path: "billing/history",
        redirect: { name: "billing", query: { tab: "payment" } },
      },
      // admin routes
      {
        path: "admin/payments",
        name: "adminPayments",
        component: () => import("../views/admin/AdminPayments.vue"),
        meta: { requiresAdmin: true },
      },
      {
        path: "admin/packages",
        name: "adminPackages",
        component: () => import("../views/admin/AdminPackages.vue"),
        meta: { requiresAdmin: true },
      },
      {
        path: "admin/users",
        name: "adminUsers",
        component: () => import("../views/admin/AdminUsers.vue"),
        meta: { requiresAdmin: true },
      },
      {
        path: "admin/devices",
        name: "adminDevices",
        component: () => import("../views/admin/AdminDevices.vue"),
        meta: { requiresAdmin: true },
      },
      {
        path: "admin/agency-packages",
        name: "adminAgencyPackages",
        component: () => import("../views/admin/AdminAgencyPackages.vue"),
        meta: { requiresAdmin: true },
      },
      {
        path: "admin/agencies",
        name: "adminAgencies",
        component: () => import("../views/admin/AdminAgencies.vue"),
        meta: { requiresAdmin: true },
      },
      {
        path: "admin/settings",
        name: "adminSettings",
        component: () => import("../views/admin/AdminSettings.vue"),
        meta: { requiresAdmin: true },
      },
      // agency routes
      {
        path: "agency/dashboard",
        name: "agencyDashboard",
        component: () => import("../views/agency/AgencyDashboard.vue"),
        meta: { requiresAgency: true },
      },
      {
        path: "agency/users",
        name: "agencyUsers",
        component: () => import("../views/agency/AgencyUsers.vue"),
        meta: { requiresAgency: true },
      },
      {
        path: "agency/users/create",
        name: "agencyCreateUser",
        component: () => import("../views/agency/AgencyCreateUser.vue"),
        meta: { requiresAgency: true },
      },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({ history: createWebHistory(), routes });

const chunkReloadKey = "instsdr_chunk_reload";

router.onError((error) => {
  const isStaleChunk =
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      error?.message ?? "",
    );

  if (isStaleChunk && !sessionStorage.getItem(chunkReloadKey)) {
    sessionStorage.setItem(chunkReloadKey, "1");
    window.location.reload();
  }
});

router.afterEach(() => {
  sessionStorage.removeItem(chunkReloadKey);
});

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore();
  if (to.name === "registerAgency" && !agencyRegistrationEnabled)
    return next("/login");
  if (to.meta.requiresAuth && !auth.isLoggedIn) return next("/login");
  if (to.meta.requiresAdmin && !auth.isAdmin) return next("/");
  if (to.meta.requiresAgency && !auth.isAgency) return next("/");
  if (
    (to.name === "login" ||
      to.name === "register" ||
      to.name === "forgotPassword" ||
      to.name === "resetPassword") &&
    auth.isLoggedIn
  )
    return next("/");
  next();
});

export default router;
