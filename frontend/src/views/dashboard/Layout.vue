<script setup>
import { useRouter, useRoute, RouterView } from "vue-router";
import { useAuthStore } from "../../stores/auth";
import { appName } from "../../config";
import Button from "../../components/ui/Button.vue";
import Badge from "../../components/ui/Badge.vue";
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import {
  LayoutDashboard,
  Smartphone,
  KeyRound,
  Webhook,
  ScrollText,
  CreditCard,
  ShieldCheck,
  Users,
  Server,
  LogOut,
  Archive,
  UserCircle,
  Reply,
  Megaphone,
  Contact as ContactIcon,
  Boxes,
  BookOpen,
  History,
  Building2,
  Settings,
  ChevronRight,
  Menu,
  X,
} from "lucide-vue-next";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const mainNav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/devices", label: "Devices", icon: Smartphone },
  { to: "/auto-reply", label: "Auto Reply", icon: Reply },
  { to: "/contact-lists", label: "Contact Lists", icon: ContactIcon },
  { to: "/broadcasts", label: "Broadcasts", icon: Megaphone },
  { to: "/billing", label: "Billing", icon: CreditCard },
];

const devNav = [
  { to: "/api-keys", label: "API Keys", icon: KeyRound },
  { to: "/webhooks", label: "Webhooks", icon: Webhook },
  { to: "/webhook-logs", label: "Webhook Logs", icon: History },
  { to: "/integrations", label: "Integrations", icon: Boxes },
  { to: "/api-docs", label: "API Docs", icon: BookOpen },
  { to: "/logs", label: "Logs", icon: ScrollText },
];

const adminNav = [
  { to: "/admin/payments", label: "Payments", icon: ShieldCheck },
  { to: "/admin/packages", label: "Packages", icon: Archive },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/devices", label: "Devices", icon: Server },
  { to: "/admin/agency-packages", label: "Agency Packages", icon: Building2 },
  { to: "/admin/agencies", label: "Agencies", icon: Users },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

const agencyNav = [
  { to: "/agency/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agency/users", label: "Users", icon: Users },
];

const sidebarOpen = ref(false);
const profileMenuOpen = ref(false);

const initials = computed(() => {
  const source = (auth.user?.name ?? "").trim() || (auth.user?.email ?? "").split("@")[0];
  if (!source) return "?";
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
});

const pageTitle = computed(() => {
  const all = [
    ...mainNav,
    ...devNav,
    ...(auth.isAdmin ? adminNav : []),
    ...(auth.isAgency ? agencyNav : []),
  ];
  const match = all.find((item) =>
    item.to === "/" ? route.path === "/" : route.path.startsWith(item.to),
  );
  return match?.label ?? "Overview";
});

const todayLabel = computed(() =>
  new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }),
);

function isActive(path) {
  if (path === "/") return route.path === "/";
  return route.path.startsWith(path);
}

function goToProfile() {
  profileMenuOpen.value = false;
  sidebarOpen.value = false;
  router.push("/profile");
}

function logout() {
  profileMenuOpen.value = false;
  sidebarOpen.value = false;
  auth.logout();
  router.push("/login");
}

function closeProfileMenu(e) {
  if (e.target.closest("[data-profile-menu]")) return;
  profileMenuOpen.value = false;
}

function handleKeyDown(e) {
  if (e.key === "Escape") {
    profileMenuOpen.value = false;
    sidebarOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", closeProfileMenu);
  document.addEventListener("keydown", handleKeyDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", closeProfileMenu);
  document.removeEventListener("keydown", handleKeyDown);
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-slate-200">
    <!-- Mobile Backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs lg:hidden"
        @click="sidebarOpen = false"
      />
    </Transition>

    <!-- Swiss Grid Sidebar (1px Hairline docked) -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <!-- Brand & Header -->
      <div class="flex h-14 items-center justify-between border-b border-slate-200 px-5">
        <router-link to="/" class="flex items-center gap-2.5 font-bold tracking-tight text-slate-900 hover:opacity-90 transition-opacity">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white text-xs font-black shadow-2xs">
            NW
          </div>
          <span class="text-base font-extrabold tracking-tight">{{ appName || 'Neowa' }}</span>
        </router-link>
        <button
          class="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          @click="sidebarOpen = false"
          aria-label="Tutup Menu"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Navigation Links -->
      <nav class="flex-1 space-y-6 overflow-y-auto px-3.5 py-4">
        <!-- Main Section -->
        <div>
          <p class="px-2.5 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Main</p>
          <div class="space-y-0.5">
            <router-link
              v-for="item in mainNav"
              :key="item.to"
              :to="item.to"
              @click="sidebarOpen = false"
              :class="[
                'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150',
                isActive(item.to)
                  ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 active:scale-[0.99]',
              ]"
            >
              <component
                :is="item.icon"
                class="h-4 w-4 shrink-0 transition-colors"
                :class="isActive(item.to) ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'"
              />
              <span class="truncate">{{ item.label }}</span>
            </router-link>
          </div>
        </div>

        <!-- Developer Section -->
        <div>
          <p class="px-2.5 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Developer</p>
          <div class="space-y-0.5">
            <router-link
              v-for="item in devNav"
              :key="item.to"
              :to="item.to"
              @click="sidebarOpen = false"
              :class="[
                'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150',
                isActive(item.to)
                  ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 active:scale-[0.99]',
              ]"
            >
              <component
                :is="item.icon"
                class="h-4 w-4 shrink-0 transition-colors"
                :class="isActive(item.to) ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'"
              />
              <span class="truncate">{{ item.label }}</span>
            </router-link>
          </div>
        </div>

        <!-- Agency Section -->
        <div v-if="auth.isAgency">
          <p class="px-2.5 pb-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700">Agency Reseller</p>
          <div class="space-y-0.5">
            <router-link
              v-for="item in agencyNav"
              :key="item.to"
              :to="item.to"
              @click="sidebarOpen = false"
              :class="[
                'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150',
                isActive(item.to)
                  ? 'bg-emerald-700 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 active:scale-[0.99]',
              ]"
            >
              <component
                :is="item.icon"
                class="h-4 w-4 shrink-0 transition-colors"
                :class="isActive(item.to) ? 'text-white' : 'text-emerald-600 group-hover:text-emerald-800'"
              />
              <span class="truncate">{{ item.label }}</span>
            </router-link>
          </div>
        </div>

        <!-- Admin Section -->
        <div v-if="auth.isAdmin">
          <p class="px-2.5 pb-2 text-[11px] font-bold uppercase tracking-wider text-amber-700">Administration</p>
          <div class="space-y-0.5">
            <router-link
              v-for="item in adminNav"
              :key="item.to"
              :to="item.to"
              @click="sidebarOpen = false"
              :class="[
                'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150',
                isActive(item.to)
                  ? 'bg-amber-600 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 active:scale-[0.99]',
              ]"
            >
              <component
                :is="item.icon"
                class="h-4 w-4 shrink-0 transition-colors"
                :class="isActive(item.to) ? 'text-white' : 'text-amber-500 group-hover:text-amber-700'"
              />
              <span class="truncate">{{ item.label }}</span>
            </router-link>
          </div>
        </div>
      </nav>

      <!-- Sidebar User Footer -->
      <div class="border-t border-slate-200 p-3 bg-slate-50/50">
        <div class="flex items-center justify-between gap-2.5 rounded-xl p-2 transition-colors hover:bg-white border border-transparent hover:border-slate-200/60">
          <div class="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer" @click="goToProfile">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white text-xs font-bold shadow-2xs">
              {{ initials }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-bold text-slate-900">{{ auth.user?.name || 'Account' }}</p>
              <p class="truncate text-[11px] text-slate-500">{{ auth.user?.email }}</p>
            </div>
          </div>
          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            title="Keluar"
            aria-label="Keluar"
            @click="logout"
          >
            <LogOut class="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Main Workspace (Full-Viewport with 1px hairline topbar) -->
    <div class="lg:ml-64 flex flex-col min-h-screen">
      <!-- Desktop & Mobile Header -->
      <header class="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 sm:px-6">
        <div class="flex items-center gap-3">
          <button
            class="lg:hidden p-1.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            @click="sidebarOpen = true"
            aria-label="Buka Menu"
          >
            <Menu class="h-5 w-5" />
          </button>
          <h1 class="text-base font-extrabold tracking-tight text-slate-900">{{ pageTitle }}</h1>
        </div>

        <div class="flex items-center gap-3">
          <span class="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 font-mono tracking-wider">
            {{ todayLabel }}
          </span>

          <Badge v-if="auth.isAdmin" variant="warning">Admin</Badge>
          <Badge v-else-if="auth.isAgency" variant="success">Agency</Badge>

          <!-- Profile Menu Dropdown -->
          <div class="relative" data-profile-menu>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white text-xs font-bold shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
              :title="auth.user?.email"
              @click.stop="profileMenuOpen = !profileMenuOpen"
            >
              {{ initials }}
            </button>

            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 translate-y-1 scale-95"
              enter-to-class="opacity-100 translate-y-0 scale-100"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100 translate-y-0 scale-100"
              leave-to-class="opacity-0 translate-y-1 scale-95"
            >
              <div
                v-if="profileMenuOpen"
                class="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg p-1.5"
              >
                <div class="border-b border-slate-100 px-3 py-2.5">
                  <p class="truncate text-xs font-bold text-slate-900">{{ auth.user?.name ?? 'Akun' }}</p>
                  <p class="truncate text-[11px] text-slate-500 font-mono">{{ auth.user?.email }}</p>
                </div>
                <div class="pt-1 space-y-0.5">
                  <button
                    type="button"
                    class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    @click="goToProfile"
                  >
                    <UserCircle class="h-3.5 w-3.5 text-slate-500" />
                    Profil
                  </button>
                  <button
                    type="button"
                    class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    @click="logout"
                  >
                    <LogOut class="h-3.5 w-3.5 text-rose-500" />
                    Keluar
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </header>

      <!-- Main App Content Canvas -->
      <main class="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        <RouterView />
      </main>
    </div>
  </div>
</template>
