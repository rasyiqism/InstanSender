<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import api from "../../services/api";
import Card from "../../components/ui/Card.vue";
import Button from "../../components/ui/Button.vue";
import Badge from "../../components/ui/Badge.vue";
import {
  Archive,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-vue-next";

const packages = ref([]);
const loading = ref(false);
const saving = ref("");
const error = ref("");
const showCreate = ref(false);
const editModal = ref({ open: false, package: null });
const deleteModal = ref({ open: false, package: null });

const defaultForm = () => ({
  name: "",
  maxDevice: 1,
  messageQuota: "",
  price: "",
  rateLimitPerSecond: 10,
  durationDays: 30,
  active: true,
});

const createForm = reactive(defaultForm());
const editForm = reactive(defaultForm());

const sortedPackages = computed(() => packages.value);

onMounted(fetchPackages);

async function fetchPackages() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.get("/admin/packages");
    packages.value = data;
  } catch (err) {
    error.value = err.response?.data?.message ?? "Failed to load packages";
  } finally {
    loading.value = false;
  }
}

function normalizePayload(form) {
  return {
    name: form.name,
    maxDevice: Number(form.maxDevice),
    messageQuota:
      form.messageQuota === "" || form.messageQuota === null
        ? null
        : Number(form.messageQuota),
    price: Number(form.price),
    rateLimitPerSecond: Number(form.rateLimitPerSecond),
    durationDays: Number(form.durationDays),
    active: Boolean(form.active),
  };
}

async function createPackage() {
  saving.value = "create";
  error.value = "";
  try {
    await api.post("/admin/packages", normalizePayload(createForm));
    Object.assign(createForm, defaultForm());
    showCreate.value = false;
    await fetchPackages();
  } catch (err) {
    error.value = err.response?.data?.message ?? "Failed to create package";
  } finally {
    saving.value = "";
  }
}

function openEdit(packageData) {
  editModal.value = { open: true, package: packageData };
  Object.assign(editForm, {
    name: packageData.name ?? "",
    maxDevice: packageData.maxDevice ?? 1,
    messageQuota: packageData.messageQuota ?? "",
    price: packageData.price ?? "",
    rateLimitPerSecond: packageData.rateLimitPerSecond ?? 10,
    durationDays: packageData.durationDays ?? 30,
    active: packageData.active ?? true,
  });
}

function closeEdit() {
  editModal.value = { open: false, package: null };
}

function openDelete(packageData) {
  deleteModal.value = { open: true, package: packageData };
}

function closeDelete() {
  deleteModal.value = { open: false, package: null };
}

async function savePackage() {
  const packageData = editModal.value.package;
  if (!packageData) return;

  saving.value = packageData.id;
  error.value = "";
  try {
    await api.patch(
      `/admin/packages/${packageData.id}`,
      normalizePayload(editForm),
    );
    closeEdit();
    await fetchPackages();
  } catch (err) {
    error.value = err.response?.data?.message ?? "Failed to save package";
  } finally {
    saving.value = "";
  }
}

async function deletePackage() {
  const packageData = deleteModal.value.package;
  if (!packageData) return;

  saving.value = packageData.id;
  error.value = "";
  try {
    await api.delete(`/admin/packages/${packageData.id}`);
    closeDelete();
    await fetchPackages();
  } catch (err) {
    error.value = err.response?.data?.message ?? "Failed to delete package";
  } finally {
    saving.value = "";
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}
</script>

<template>
  <div class="space-y-6">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
          Packages
        </h2>
        <p class="mt-1.5 text-sm text-slate-500">
          Manage subscription packages, quotas, prices, and availability.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" @click="fetchPackages">
          <RefreshCw class="h-4 w-4" />
          Refresh
        </Button>
        <Button variant="primary" @click="showCreate = !showCreate">
          <Plus class="h-4 w-4" />
          {{ showCreate ? "Close" : "Add Package" }}
        </Button>
      </div>
    </div>

    <div
      v-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <Card v-if="showCreate" class="p-5">
      <form
        class="grid gap-3 md:grid-cols-2 xl:grid-cols-7"
        @submit.prevent="createPackage"
      >
        <input
          v-model="createForm.name"
          required
          placeholder="Name"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          v-model.number="createForm.maxDevice"
          required
          min="1"
          type="number"
          placeholder="Max device"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          v-model="createForm.messageQuota"
          min="0"
          type="number"
          placeholder="Quota"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          v-model.number="createForm.price"
          required
          type="number"
          step="1"
          min="0"
          placeholder="Price"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          v-model.number="createForm.rateLimitPerSecond"
          required
          min="1"
          type="number"
          placeholder="Rate/s"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          v-model.number="createForm.durationDays"
          required
          min="1"
          type="number"
          placeholder="Days"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 text-sm text-slate-600">
            <input
              v-model="createForm.active"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-primary"
            />
            Active
          </label>
          <Button type="submit" :disabled="saving === 'create'">
            <Loader2 v-if="saving === 'create'" class="h-4 w-4 animate-spin" />
            <Save v-else class="h-4 w-4" />
            Create
          </Button>
        </div>
      </form>
    </Card>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Loading packages...</span>
    </div>

    <Card
      v-else-if="!sortedPackages.length"
      class="flex flex-col items-center p-12 text-center"
    >
      <div
        class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary"
      >
        <Archive class="h-7 w-7" />
      </div>
      <h3 class="text-lg font-semibold text-slate-900">No packages yet</h3>
      <p class="mt-1 text-sm text-slate-500">
        Create the first subscription package for billing.
      </p>
    </Card>

    <Card v-else class="overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100">
          <thead class="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3 font-semibold">Package</th>
              <th class="px-4 py-3 font-semibold">Limits</th>
              <th class="px-4 py-3 font-semibold">Price</th>
              <th class="px-4 py-3 font-semibold">Duration</th>
              <th class="px-4 py-3 font-semibold">Status</th>
              <th class="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-sm">
            <tr v-for="packageData in sortedPackages" :key="packageData.id">
              <td class="px-4 py-3">
                <p class="font-semibold text-slate-900">
                  {{ packageData.name }}
                </p>
                <p class="text-xs text-slate-500">{{ packageData.id }}</p>
              </td>
              <td class="px-4 py-3 text-slate-600">
                <p>{{ packageData.maxDevice }} devices</p>
                <p class="text-xs text-slate-500">
                  {{
                    packageData.messageQuota === null
                      ? "Unlimited messages"
                      : `${packageData.messageQuota} messages`
                  }}
                  · {{ packageData.rateLimitPerSecond }}/s
                </p>
              </td>
              <td class="px-4 py-3 font-medium text-slate-900">
                {{ formatCurrency(packageData.price) }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ packageData.durationDays }} days
              </td>
              <td class="px-4 py-3">
                <Badge :variant="packageData.active ? 'success' : 'default'">
                  {{ packageData.active ? "active" : "inactive" }}
                </Badge>
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    @click="openEdit(packageData)"
                  >
                    <Pencil class="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    @click="openDelete(packageData)"
                  >
                    <Trash2 class="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <div
      v-if="editModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
    >
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto p-6">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Edit Package</h3>
            <p class="mt-1 text-sm text-slate-500">
              Update package limits, pricing, and status.
            </p>
          </div>
          <button
            class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            @click="closeEdit"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <form class="grid gap-4 md:grid-cols-2" @submit.prevent="savePackage">
          <label class="space-y-1 text-sm font-medium text-slate-700">
            <span>Name</span>
            <input
              v-model="editForm.name"
              required
              class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label class="space-y-1 text-sm font-medium text-slate-700">
            <span>Price</span>
            <input
              v-model.number="editForm.price"
              required
              type="number"
              step="1"
              min="0"
              class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label class="space-y-1 text-sm font-medium text-slate-700">
            <span>Max Device</span>
            <input
              v-model.number="editForm.maxDevice"
              required
              min="1"
              type="number"
              class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label class="space-y-1 text-sm font-medium text-slate-700">
            <span>Message Quota</span>
            <input
              v-model="editForm.messageQuota"
              min="0"
              type="number"
              placeholder="Blank for unlimited"
              class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label class="space-y-1 text-sm font-medium text-slate-700">
            <span>Rate Limit / Second</span>
            <input
              v-model.number="editForm.rateLimitPerSecond"
              required
              min="1"
              type="number"
              class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label class="space-y-1 text-sm font-medium text-slate-700">
            <span>Duration Days</span>
            <input
              v-model.number="editForm.durationDays"
              required
              min="1"
              type="number"
              class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input
              v-model="editForm.active"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-primary"
            />
            Active
          </label>

          <div class="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="outline" @click="closeEdit">
              Cancel
            </Button>
            <Button type="submit" :disabled="saving === editModal.package?.id">
              <Loader2
                v-if="saving === editModal.package?.id"
                class="h-4 w-4 animate-spin"
              />
              <Save v-else class="h-4 w-4" />
              Save
            </Button>
          </div>
        </form>
      </Card>
    </div>

    <div
      v-if="deleteModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
    >
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6">
        <div class="mb-5">
          <h3 class="text-lg font-bold text-slate-900">Delete Package</h3>
          <p class="mt-2 text-sm text-slate-500">
            Delete {{ deleteModal.package?.name }}? Package that is already used
            by subscriptions should be set inactive instead.
          </p>
        </div>
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="closeDelete">Cancel</Button>
          <Button
            variant="danger"
            :disabled="saving === deleteModal.package?.id"
            @click="deletePackage"
          >
            <Loader2
              v-if="saving === deleteModal.package?.id"
              class="h-4 w-4 animate-spin"
            />
            <Trash2 v-else class="h-4 w-4" />
            Delete
          </Button>
        </div>
      </Card>
    </div>
  </div>
</template>
