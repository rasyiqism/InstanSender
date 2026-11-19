<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import QRCode from "qrcode";
import {
  Plus,
  QrCode,
  Trash2,
  X,
  Smartphone,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  Fingerprint,
} from "lucide-vue-next";
import { useDeviceStore } from "../../stores/device";
import Button from "../../components/ui/Button.vue";
import Input from "../../components/ui/Input.vue";
import Card from "../../components/ui/Card.vue";
import Badge from "../../components/ui/Badge.vue";
import Alert from "../../components/ui/Alert.vue";
import Modal from "../../components/ui/Modal.vue";

const store = useDeviceStore();
const addModal = ref({ open: false, loading: false });
const newName = ref("");
const addError = ref("");
const qrModal = ref({
  open: false,
  deviceId: "",
  qr: null,
  image: null,
  status: "pending_qr",
  error: "",
});
const qrPolling = ref(null);
const listPolling = ref(null);
const copiedId = ref("");
const deleteModal = ref({ open: false, device: null, loading: false });

onMounted(() => {
  store.fetch();
  listPolling.value = setInterval(() => {
    if (!qrModal.value.open) store.fetch();
  }, 10000);
});

function badgeVariant(status) {
  if (status === "connected") return "success";
  if (status === "reconnecting") return "info";
  if (status === "pending_qr") return "warning";
  return "destructive";
}

function badgeLabel(status) {
  if (status === "connected") return "Connected";
  if (status === "reconnecting") return "Reconnecting";
  if (status === "pending_qr") return "Pending QR";
  return "Disconnected";
}

async function renderQr(qr) {
  if (!qr) return null;
  return QRCode.toDataURL(qr, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
  });
}

async function refreshQr(deviceId) {
  const result = await store.getQr(deviceId);
  qrModal.value.status = result.status;
  if (result.qr && result.qr !== qrModal.value.qr) {
    qrModal.value.qr = result.qr;
    qrModal.value.image = await renderQr(result.qr);
  }
}

function openAdd() {
  newName.value = "";
  addError.value = "";
  addModal.value = { open: true, loading: false };
}

function closeAdd() {
  if (addModal.value.loading) return;
  addModal.value = { open: false, loading: false };
  addError.value = "";
  newName.value = "";
}

async function addDevice() {
  if (!newName.value.trim()) return;
  addError.value = "";
  addModal.value.loading = true;
  try {
    const result = await store.create(newName.value.trim());
    newName.value = "";
    addModal.value = { open: false, loading: false };
    openQr(result.device.id, result.qr);
  } catch (err) {
    addError.value = err.response?.data?.message ?? "Failed to add device";
  } finally {
    addModal.value.loading = false;
  }
}

async function openQr(deviceId, initialQr) {
  closeQr();
  qrModal.value = {
    open: true,
    deviceId,
    qr: initialQr,
    image: await renderQr(initialQr),
    status: "pending_qr",
    error: "",
  };
  if (!initialQr) {
    refreshQr(deviceId).catch(() => {
      qrModal.value.error =
        "Failed to load QR code. Make sure WA Connector is running.";
    });
  }
  qrPolling.value = setInterval(async () => {
    try {
      const status = await store.getStatus(deviceId);
      qrModal.value.status = status.status;
      if (status.status === "connected") {
        closeQr();
        await store.fetch();
        return;
      }
      if (qrModal.value.open) {
        await refreshQr(deviceId);
      }
    } catch {
      qrModal.value.error = "Waiting for WA Connector response...";
    }
  }, 3000);
}

function closeQr() {
  qrModal.value.open = false;
  if (qrPolling.value) {
    clearInterval(qrPolling.value);
    qrPolling.value = null;
  }
}

function openDelete(device) {
  deleteModal.value = { open: true, device, loading: false };
}

function closeDelete() {
  if (deleteModal.value.loading) return;
  deleteModal.value = { open: false, device: null, loading: false };
}

async function confirmDelete() {
  if (!deleteModal.value.device) return;
  deleteModal.value.loading = true;
  await store.remove(deleteModal.value.device.id);
  deleteModal.value = { open: false, device: null, loading: false };
}

function copyDeviceId(id) {
  navigator.clipboard.writeText(id);
  copiedId.value = id;
  setTimeout(() => (copiedId.value = ""), 2000);
}

onUnmounted(() => {
  closeQr();
  if (listPolling.value) clearInterval(listPolling.value);
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
          Devices
        </h2>
        <p class="mt-1.5 text-sm text-slate-500">
          Connect and manage your WhatsApp numbers.
        </p>
      </div>
      <Button @click="openAdd" class="gap-1.5">
        <Plus class="h-4 w-4" />
        Add Device
      </Button>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Loading devices...</span>
    </div>

    <!-- Empty State -->
    <Card
      v-else-if="!store.devices.length"
      class="flex flex-col items-center p-12 text-center"
    >
      <div
        class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary"
      >
        <QrCode class="h-7 w-7" />
      </div>
      <p class="text-lg font-bold text-slate-900">No devices yet</p>
      <p class="mt-1 text-sm text-slate-500">
        Click "Add Device" above to connect your first WhatsApp number.
      </p>
    </Card>

    <!-- Device List -->
    <div v-else class="grid gap-4">
      <Card
        v-for="d in store.devices"
        :key="d.id"
        class="group overflow-hidden p-0 transition-all duration-200 hover:shadow-md"
      >
        <div class="flex items-center justify-between gap-4 p-5">
          <div class="flex items-center gap-4">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 group-hover:bg-primary-50 group-hover:text-primary transition-colors duration-200"
            >
              <Smartphone class="h-5 w-5" />
            </div>
            <div>
              <p class="font-semibold text-slate-900">{{ d.name }}</p>
              <p class="text-xs text-slate-500">
                {{ d.phoneNumber ?? "No phone number yet" }}
              </p>
              <button
                class="mt-0.5 inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-mono text-[11px] text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                @click.stop="copyDeviceId(d.id)"
                :title="'Copy device ID'"
              >
                <Fingerprint v-if="copiedId !== d.id" class="h-3 w-3" />
                <Check v-else class="h-3 w-3 text-primary" />
                {{ copiedId === d.id ? "Copied!" : d.id }}
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Badge :variant="badgeVariant(d.status)">{{
              badgeLabel(d.status)
            }}</Badge>
            <Button
              v-if="d.status !== 'connected' && d.status !== 'reconnecting'"
              variant="outline"
              size="sm"
              @click="openQr(d.id)"
              class="gap-1.5"
            >
              <QrCode class="h-3.5 w-3.5" />
              QR
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="text-slate-400 hover:bg-red-50 hover:text-red-600"
              @click="openDelete(d)"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>

    <!-- QR Modal -->
    <div
      v-if="qrModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      @click.self="closeQr"
    >
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-0 shadow-2xl">
        <div class="p-6 text-center">
          <div
            class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary"
          >
            <QrCode class="h-7 w-7" />
          </div>
          <h3 class="text-lg font-bold text-slate-900">Scan QR Code</h3>
          <p class="mt-2 text-sm text-slate-500">
            Open WhatsApp on your phone → <strong>Linked Devices</strong> →
            <strong>Link a Device</strong>, then scan this code.
          </p>

          <div v-if="qrModal.image" class="mt-5 flex justify-center">
            <div
              class="relative rounded-2xl border-2 border-primary-100 bg-white p-3"
            >
              <img
                :src="qrModal.image"
                alt="WhatsApp QR code"
                class="h-64 w-64"
              />
            </div>
          </div>
          <Alert v-else variant="warning" class="mt-4 text-left text-sm">
            <Loader2 class="mr-1 inline h-3.5 w-3.5 animate-spin" /> Generating
            QR code... Please wait.
          </Alert>
          <Alert
            v-if="qrModal.error"
            variant="warning"
            class="mt-3 text-left text-sm"
            >{{ qrModal.error }}</Alert
          >

          <div
            class="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400"
          >
            <RefreshCw class="h-3 w-3 animate-pulse" />
            Auto-refreshing every 3 seconds until connected
          </div>
        </div>

        <div class="border-t border-slate-100 bg-slate-50 p-3">
          <Button variant="ghost" class="w-full" @click="closeQr">Close</Button>
        </div>
      </Card>
    </div>

    <!-- Delete Device Modal -->
    <div
      v-if="deleteModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="closeDelete"
    >
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-0 shadow-2xl">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 class="font-semibold text-slate-900">Remove Device</h3>
          <Button variant="ghost" size="icon" @click="closeDelete" :disabled="deleteModal.loading">
            <X class="h-4 w-4" />
          </Button>
        </div>

        <!-- Body -->
        <div class="flex flex-col items-center gap-3 p-6 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
            <Trash2 class="h-6 w-6" />
          </div>
          <div>
            <p class="font-semibold text-slate-900">
              Remove "{{ deleteModal.device?.name }}"?
            </p>
            <p class="mt-1 text-sm text-slate-500">
              Device ini akan diputus dan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <Button variant="outline" @click="closeDelete" :disabled="deleteModal.loading">
            Batal
          </Button>
          <Button variant="destructive" @click="confirmDelete" :disabled="deleteModal.loading" class="gap-1.5">
            <Loader2 v-if="deleteModal.loading" class="h-4 w-4 animate-spin" />
            <Trash2 v-else class="h-4 w-4" />
            {{ deleteModal.loading ? "Menghapus…" : "Hapus Device" }}
          </Button>
        </div>
      </Card>
    </div>

    <!-- Add Device Modal -->
    <Modal
      :open="addModal.open"
      title="Add New Device"
      :icon="Plus"
      variant="success"
      close-text="Cancel"
      @close="closeAdd"
    >
      <p class="text-sm leading-relaxed text-slate-500">
        Beri nama untuk perangkat ini agar mudah dikenali nanti.
      </p>
      <Alert v-if="addError" variant="destructive" class="mt-4 text-sm">{{ addError }}</Alert>
      <form id="add-device-form" @submit.prevent="addDevice" class="mt-4 space-y-4">
        <div class="space-y-2">
          <label for="device-name" class="text-sm font-medium text-slate-700">Device Name</label>
          <Input
            id="device-name"
            v-model="newName"
            placeholder="e.g. HP Toko Jakarta"
            required
            class="h-11"
            :disabled="addModal.loading"
          />
        </div>
      </form>
      <template #footer>
        <Button variant="outline" @click="closeAdd" :disabled="addModal.loading">Cancel</Button>
        <Button type="submit" form="add-device-form" :disabled="addModal.loading" class="gap-1.5">
          <Loader2 v-if="addModal.loading" class="h-4 w-4 animate-spin" />
          <Plus v-else class="h-4 w-4" />
          {{ addModal.loading ? "Adding..." : "Add Device" }}
        </Button>
      </template>
    </Modal>
  </div>
</template>
