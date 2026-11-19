<script setup>
import { computed, onMounted, ref } from "vue";
import { useApiKeyStore } from "../../stores/apiKey";
import { useDeviceStore } from "../../stores/device";
import { apiBaseUrl } from "../../config";
import Button from "../../components/ui/Button.vue";
import Card from "../../components/ui/Card.vue";
import Badge from "../../components/ui/Badge.vue";
import Alert from "../../components/ui/Alert.vue";
import Modal from "../../components/ui/Modal.vue";
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Eye,
  EyeOff,
  Terminal,
  ShieldCheck,
  Globe,
  Smartphone,
  XCircle,
} from "lucide-vue-next";

const store = useApiKeyStore();
const deviceStore = useDeviceStore();
const generating = ref(false);
const newKey = ref({ show: false, key: "", note: "" });
const selectedDeviceId = ref("");
const showKey = ref(false);
const copiedFull = ref("");
const copiedBase = ref(false);
const revokeModal = ref({ open: false, key: null });
// Track which keys are currently revealed (show/hide per key).
const visibleKeys = ref(new Set());

function toggleVisible(id) {
  const next = new Set(visibleKeys.value);
  next.has(id) ? next.delete(id) : next.add(id);
  visibleKeys.value = next;
}
function isVisible(id) {
  return visibleKeys.value.has(id);
}

// Strip the "/api" suffix so the example shows a clean base URL.
const baseUrl = computed(() => apiBaseUrl.replace(/\/api\/?$/, ""));

onMounted(async () => {
  await Promise.all([store.fetch(), deviceStore.fetch()]);
});

const activeCount = computed(
  () => store.keys.filter((k) => !k.revokedAt).length,
);
const revokedCount = computed(() => store.keys.length - activeCount.value);

async function generate() {
  generating.value = true;
  try {
    const result = await store.generate(selectedDeviceId.value || undefined);
    newKey.value = { show: true, key: result.apiKey, note: result.note };
    showKey.value = true;
  } finally {
    generating.value = false;
  }
}

function openRevoke(key) {
  revokeModal.value = { open: true, key };
}

function closeRevoke() {
  revokeModal.value = { open: false, key: null };
}

async function revoke() {
  const key = revokeModal.value.key;
  if (!key) return;
  await store.revoke(key.id);
  closeRevoke();
}

async function copyFull(text) {
  try {
    await navigator.clipboard.writeText(text);
    copiedFull.value = text;
    setTimeout(() => (copiedFull.value = ""), 2000);
  } catch {
    /* fallback */
  }
}

async function copyBase() {
  try {
    await navigator.clipboard.writeText(baseUrl.value);
    copiedBase.value = true;
    setTimeout(() => (copiedBase.value = false), 2000);
  } catch {
    /* fallback */
  }
}

function scopeLabel(k) {
  if (!k.deviceId) return "Account-wide";
  const d = deviceStore.devices.find((d) => d.id === k.deviceId);
  return d ? d.name : "Device";
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
          API Keys
        </h2>
        <p class="mt-1.5 text-sm text-slate-500">
          Generate and manage keys for programmatic access to the API.
        </p>
      </div>
      <Button
        @click="
          newKey.show = false;
          generate();
        "
        :disabled="generating"
      >
        <Loader2 v-if="generating" class="h-4 w-4 animate-spin" />
        <Plus v-else class="h-4 w-4" />
        {{ generating ? "Generating..." : "Generate Key" }}
      </Button>
    </div>

    <!-- Quick start / base URL -->
    <Card class="overflow-hidden p-0">
      <div class="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
            <Terminal class="h-5 w-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900">Base URL</h3>
            <p class="mt-0.5 text-xs text-slate-500">
              Send the key in the <code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-primary">Authorization</code> header as a Bearer token.
            </p>
          </div>
        </div>
      </div>
    </Card>

    <!-- New Key Banner -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <Alert v-if="newKey.show" variant="success" class="p-0">
        <div class="p-5">
          <div class="mb-3 flex items-center gap-2">
            <CheckCircle2 class="h-4 w-4" />
            <span class="font-semibold">Key generated successfully</span>
          </div>
          <p class="mb-2 text-sm font-medium text-primary-800">
            Copy your new API key now — it won't be shown again.
          </p>
          <div class="group relative">
            <code
              class="block rounded-xl border border-primary-200 bg-white px-4 py-3 font-mono text-sm break-all shadow-sm"
            >
              {{
                showKey
                  ? newKey.key
                  : newKey.key.slice(0, 12) + "••••••••••••••••••"
              }}
            </code>
            <div class="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" @click="showKey = !showKey">
                <Eye v-if="!showKey" class="h-3.5 w-3.5" />
                <EyeOff v-else class="h-3.5 w-3.5" />
                {{ showKey ? "Hide" : "Reveal" }}
              </Button>
              <Button variant="secondary" size="sm" @click="copyFull(newKey.key)">
                <Copy class="h-3.5 w-3.5" />
                {{ copiedFull === newKey.key ? "Copied!" : "Copy" }}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="text-primary-700 hover:text-primary-800"
                @click="newKey.show = false"
              >
                Dismiss
              </Button>
            </div>
          </div>
          <p v-if="newKey.note" class="mt-2 text-xs text-primary-600">
            {{ newKey.note }}
          </p>
        </div>
      </Alert>
    </Transition>

    <!-- Device scope selector -->
    <Card v-if="deviceStore.devices.length" class="p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <ShieldCheck class="h-4 w-4" />
          </div>
          <div>
            <p class="text-sm font-semibold text-slate-900">Scope next key to</p>
            <p class="text-xs text-slate-500">
              Limit a key to a single device or the whole account.
            </p>
          </div>
        </div>
        <select
          v-model="selectedDeviceId"
          class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-64"
        >
          <option value="">Account-wide (all devices)</option>
          <option v-for="d in deviceStore.devices" :key="d.id" :value="d.id">
            {{ d.name }}
          </option>
        </select>
      </div>
    </Card>

    <!-- Loading -->
    <div v-if="store.loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Loading keys...</span>
    </div>

    <!-- Empty State -->
    <Card
      v-else-if="!store.keys.length"
      class="flex flex-col items-center p-12 text-center"
    >
      <div
        class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary"
      >
        <KeyRound class="h-7 w-7" />
      </div>
      <p class="text-lg font-bold text-slate-900">No API keys yet</p>
      <p class="mt-1 text-sm text-slate-500">
        Generate your first key to start sending messages programmatically.
      </p>
      <Button class="mt-5" :disabled="generating" @click="generate">
        <Loader2 v-if="generating" class="h-4 w-4 animate-spin" />
        <Plus v-else class="h-4 w-4" />
        Generate your first key
      </Button>
    </Card>

    <!-- Key List -->
    <template v-else>
      <!-- Summary chips -->
      <div class="flex flex-wrap items-center gap-2">
        <Badge variant="success">{{ activeCount }} Active</Badge>
        <Badge v-if="revokedCount" variant="destructive">{{ revokedCount }} Revoked</Badge>
      </div>

      <div class="space-y-3">
        <Card
          v-for="k in store.keys"
          :key="k.id"
          class="group p-4 transition-all duration-200 hover:shadow-md sm:p-5"
          :class="{ 'opacity-60': k.revokedAt }"
        >
          <!-- Top row: key + actions -->
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex min-w-0 items-center gap-2">
              <Badge v-if="k.revokedAt" variant="destructive">Revoked</Badge>
              <Badge v-else variant="success">Active</Badge>
              <span class="hidden text-xs text-slate-400 sm:inline">·</span>
              <span class="hidden items-center gap-1.5 text-xs text-slate-500 sm:inline-flex">
                <component
                  :is="k.deviceId ? Smartphone : Globe"
                  class="h-3.5 w-3.5 text-slate-400"
                />
                {{ scopeLabel(k) }}
              </span>
            </div>

            <div class="flex shrink-0 items-center gap-1.5">
              <!-- Show / hide -->
              <Button
                v-if="k.apiKey"
                variant="ghost"
                size="icon"
                class="h-9 w-9 text-slate-400 hover:text-slate-700"
                :title="isVisible(k.id) ? 'Hide key' : 'Show key'"
                @click="toggleVisible(k.id)"
              >
                <EyeOff v-if="isVisible(k.id)" class="h-4 w-4" />
                <Eye v-else class="h-4 w-4" />
              </Button>
              <!-- Copy -->
              <Button
                v-if="k.apiKey"
                variant="outline"
                size="sm"
                class="h-9 gap-1.5"
                @click="copyFull(k.apiKey)"
              >
                <Check v-if="copiedFull === k.apiKey" class="h-3.5 w-3.5 text-primary" />
                <Copy v-else class="h-3.5 w-3.5" />
                {{ copiedFull === k.apiKey ? "Copied" : "Copy" }}
              </Button>
              <!-- Revoke -->
              <Button
                v-if="!k.revokedAt"
                variant="ghost"
                size="icon"
                class="h-9 w-9 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="Revoke key"
                @click="openRevoke(k)"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </div>

          <!-- Key display -->
          <div class="mt-3 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <KeyRound class="h-4 w-4 shrink-0 text-slate-400" />
            <code class="min-w-0 flex-1 truncate font-mono text-sm text-slate-700">
              <template v-if="k.apiKey">
                {{ isVisible(k.id) ? k.apiKey : k.keyPrefix + '••••••••••••••••••' + k.keySuffix }}
              </template>
              <template v-else>
                {{ k.keyPrefix }}<span class="text-slate-300">••••••</span>{{ k.keySuffix }}
              </template>
            </code>
          </div>

          <!-- Meta -->
          <div class="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>ID {{ k.id.slice(0, 8) }}…</span>
            <span>Created {{ formatDate(k.createdAt) }}</span>
          </div>
        </Card>
      </div>
    </template>

    <!-- Revoke modal -->
    <Modal
      :open="revokeModal.open"
      title="Revoke API Key"
      variant="destructive"
      :icon="Trash2"
      @close="closeRevoke"
    >
      <p class="font-medium text-slate-900">Revoke this API key?</p>
      <p class="mt-2 text-sm text-slate-500">
        All requests using it will be rejected immediately. This action can't be undone.
      </p>
      <p v-if="revokeModal.key" class="mt-3 font-mono text-xs text-slate-500">
        {{ revokeModal.key.keyPrefix }}…
      </p>
      <template #footer>
        <Button variant="outline" @click="closeRevoke">Cancel</Button>
        <Button variant="destructive" @click="revoke">
          <Trash2 class="h-4 w-4" />
          Revoke
        </Button>
      </template>
    </Modal>
  </div>
</template>
