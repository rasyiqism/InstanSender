<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import api from "../../services/api";
import Card from "../../components/ui/Card.vue";
import Button from "../../components/ui/Button.vue";
import Badge from "../../components/ui/Badge.vue";
import {
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  ExternalLink,
  Hash,
  Loader2,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
  XCircle,
} from "lucide-vue-next";

const statuses = ["all", "pending", "paid", "rejected"];
const payments = ref([]);
const users = ref([]);
const loading = ref(false);
const saving = ref("");
const error = ref("");
const statusFilter = ref("all");
const showCreate = ref(false);
const actionMenu = ref("");
const detailModal = ref({ open: false, payment: null });
const rejectModal = ref({ open: false, payment: null, reason: "" });
const editModal = ref({ open: false, payment: null });
const deleteModal = ref({ open: false, payment: null });
const createForm = reactive({
  userId: "",
  subscriptionId: "",
  amount: "",
  kodeUnik: 0,
  bankAccountTujuan: "",
  buktiTransferUrl: "",
  status: "pending",
  rejectionReason: "",
});
const editForm = reactive({
  amount: "",
  kodeUnik: 0,
  bankAccountTujuan: "",
  buktiTransferUrl: "",
  status: "pending",
  rejectionReason: "",
});

const userOptions = computed(() =>
  users.value.map((u) => ({ id: u.id, label: u.email })),
);

onMounted(() => {
  fetchUsers();
  fetchPayments();
});

function badgeVariant(status) {
  if (status === "paid") return "success";
  if (status === "pending") return "warning";
  return "destructive";
}

async function fetchUsers() {
  const { data } = await api.get("/admin/users");
  users.value = data;
}

async function fetchPayments() {
  loading.value = true;
  error.value = "";
  try {
    const params =
      statusFilter.value === "all" ? {} : { status: statusFilter.value };
    const { data } = await api.get("/admin/payments", { params });
    payments.value = data;
  } catch (err) {
    error.value = err.response?.data?.message ?? "Failed to load payments";
  } finally {
    loading.value = false;
  }
}

function payloadFromEdit() {
  return {
    amount: editForm.amount,
    kodeUnik: Number(editForm.kodeUnik),
    bankAccountTujuan: editForm.bankAccountTujuan,
    buktiTransferUrl: editForm.buktiTransferUrl || "",
    status: editForm.status,
    rejectionReason: editForm.rejectionReason || "",
  };
}

async function createPayment() {
  saving.value = "create";
  error.value = "";
  try {
    await api.post("/admin/payments", {
      userId: createForm.userId,
      subscriptionId: createForm.subscriptionId || undefined,
      amount: createForm.amount,
      kodeUnik: Number(createForm.kodeUnik),
      bankAccountTujuan: createForm.bankAccountTujuan,
      buktiTransferUrl: createForm.buktiTransferUrl || undefined,
      status: createForm.status,
      rejectionReason: createForm.rejectionReason || undefined,
    });
    Object.assign(createForm, {
      userId: "",
      subscriptionId: "",
      amount: "",
      kodeUnik: 0,
      bankAccountTujuan: "",
      buktiTransferUrl: "",
      status: "pending",
      rejectionReason: "",
    });
    showCreate.value = false;
    await fetchPayments();
  } catch (err) {
    error.value = err.response?.data?.message ?? "Failed to create payment";
  } finally {
    saving.value = "";
  }
}

function openEdit(payment) {
  actionMenu.value = "";
  editModal.value = { open: true, payment };
  Object.assign(editForm, {
    amount: payment.amount ?? "",
    kodeUnik: payment.kodeUnik ?? 0,
    bankAccountTujuan: payment.bankAccountTujuan ?? "",
    buktiTransferUrl: payment.buktiTransferUrl ?? "",
    status: payment.status ?? "pending",
    rejectionReason: payment.rejectionReason ?? "",
  });
}

function openDetail(payment) {
  actionMenu.value = "";
  detailModal.value = { open: true, payment };
}

function closeDetail() {
  detailModal.value = { open: false, payment: null };
}

function openReject(payment) {
  actionMenu.value = "";
  rejectModal.value = { open: true, payment, reason: "" };
}

function closeReject() {
  rejectModal.value = { open: false, payment: null, reason: "" };
}

function closeEdit() {
  editModal.value = { open: false, payment: null };
}

function openDelete(payment) {
  actionMenu.value = "";
  deleteModal.value = { open: true, payment };
}

function closeDelete() {
  deleteModal.value = { open: false, payment: null };
}

async function savePayment() {
  const payment = editModal.value.payment;
  if (!payment) return;

  saving.value = payment.id;
  error.value = "";
  try {
    await api.patch(`/admin/payments/${payment.id}`, payloadFromEdit());
    closeEdit();
    await fetchPayments();
  } catch (err) {
    error.value = err.response?.data?.message ?? "Failed to save payment";
  } finally {
    saving.value = "";
  }
}

async function approve(id) {
  actionMenu.value = "";
  saving.value = id;
  error.value = "";
  try {
    await api.post(`/admin/payments/${id}/approve`);
    await fetchPayments();
  } catch (err) {
    error.value = err.response?.data?.message ?? "Failed to approve payment";
  } finally {
    saving.value = "";
  }
}

async function rejectPayment() {
  const payment = rejectModal.value.payment;
  if (!payment) return;

  saving.value = payment.id;
  error.value = "";
  try {
    await api.post(`/admin/payments/${payment.id}/reject`, {
      reason: rejectModal.value.reason || "Not verified",
    });
    closeReject();
    await fetchPayments();
  } catch (err) {
    error.value = err.response?.data?.message ?? "Failed to reject payment";
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

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatEndDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
  }).format(new Date(value));
}

function isExpired(value) {
  if (!value) return false;
  return new Date(value) < new Date();
}

function daysUntilExpiry(value) {
  if (!value) return null;
  const diff = Math.ceil((new Date(value) - new Date()) / 86400000);
  return diff;
}

async function deletePayment() {
  const payment = deleteModal.value.payment;
  if (!payment) return;

  saving.value = payment.id;
  error.value = "";
  try {
    await api.delete(`/admin/payments/${payment.id}`);
    closeDelete();
    await fetchPayments();
  } catch (err) {
    error.value = err.response?.data?.message ?? "Failed to delete payment";
  } finally {
    saving.value = "";
  }
}
</script>

<template>
  <div class="space-y-6">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
          Payments
        </h2>
        <p class="mt-1.5 text-sm text-slate-500">
          Manage payment records across every status.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" @click="fetchPayments">
          <RefreshCw class="h-4 w-4" />
          Refresh
        </Button>
        <Button variant="primary" @click="showCreate = !showCreate">
          <Plus class="h-4 w-4" />
          {{ showCreate ? "Close" : "Add Payment" }}
        </Button>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <Button
        v-for="status in statuses"
        :key="status"
        size="sm"
        :variant="statusFilter === status ? 'default' : 'outline'"
        @click="
          statusFilter = status;
          fetchPayments();
        "
      >
        {{ status }}
      </Button>
    </div>

    <div
      v-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <Card v-if="showCreate" class="p-5">
      <form
        class="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        @submit.prevent="createPayment"
      >
        <select
          v-model="createForm.userId"
          required
          class="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="" disabled>User</option>
          <option v-for="u in userOptions" :key="u.id" :value="u.id">
            {{ u.label }}
          </option>
        </select>
        <input
          v-model="createForm.subscriptionId"
          placeholder="Subscription ID (optional)"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          v-model="createForm.amount"
          required
          inputmode="numeric"
          placeholder="Amount"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          v-model.number="createForm.kodeUnik"
          required
          type="number"
          min="0"
          placeholder="Kode unik"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          v-model="createForm.bankAccountTujuan"
          required
          placeholder="Bank account"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm xl:col-span-2"
        />
        <input
          v-model="createForm.buktiTransferUrl"
          placeholder="Proof URL"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <select
          v-model="createForm.status"
          class="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="pending">pending</option>
          <option value="paid">paid</option>
          <option value="rejected">rejected</option>
        </select>
        <input
          v-model="createForm.rejectionReason"
          placeholder="Rejection reason"
          class="h-10 rounded-xl border border-slate-200 px-3 text-sm xl:col-span-3"
        />
        <Button type="submit" :disabled="saving === 'create'">
          <Loader2 v-if="saving === 'create'" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          Create
        </Button>
      </form>
    </Card>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Loading payments...</span>
    </div>

    <Card v-else-if="!payments.length" class="p-12 text-center">
      <p class="text-lg font-bold text-slate-900">No payments found</p>
      <p class="mt-1 text-sm text-slate-500">
        Change the status filter or add a payment manually.
      </p>
    </Card>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-slate-200 bg-white"
    >
      <table class="min-w-295 w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">User</th>
            <th class="px-4 py-3">Amount</th>
            <th class="px-4 py-3">Code</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Subscription</th>
            <!-- <th class="px-4 py-3">Bank</th> -->
            <th class="px-4 py-3">Proof</th>
            <th class="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in payments" :key="p.id" class="border-t align-top">
            <td class="px-4 py-3">
              <p class="font-medium text-slate-900">
                {{ p.user?.email ?? p.userId }}
              </p>
              <p class="mt-1 text-xs text-slate-500">
                {{ new Date(p.createdAt).toLocaleString() }}
              </p>
            </td>
            <td class="px-4 py-3">
              <p class="font-medium text-slate-900">
                Rp {{ Number(p.amount).toLocaleString() }}
              </p>
            </td>
            <td class="px-4 py-3">
              {{ p.kodeUnik }}
            </td>
            <td class="px-4 py-3">
              <Badge :variant="badgeVariant(p.status)">{{ p.status }}</Badge>
              <p
                v-if="p.rejectionReason"
                class="mt-2 max-w-44 text-xs text-slate-500"
              >
                {{ p.rejectionReason }}
              </p>
            </td>
            <td class="px-4 py-3">
              <p v-if="p.subscription?.package?.name" class="font-medium text-slate-900">
                {{ p.subscription.package.name }}
              </p>
              <p v-else class="text-xs text-slate-400">No package</p>
              <p
                v-if="p.subscription?.endDate"
                class="mt-1 inline-flex items-center gap-1 text-xs"
                :class="isExpired(p.subscription.endDate) ? 'text-red-600' : 'text-slate-500'"
              >
                <CalendarClock class="h-3.5 w-3.5" :class="isExpired(p.subscription.endDate) ? 'text-red-500' : 'text-slate-400'" />
                {{ formatEndDate(p.subscription.endDate) }}
              </p>
              <p
                v-if="p.subscription?.endDate && !isExpired(p.subscription.endDate) && daysUntilExpiry(p.subscription.endDate) <= 7"
                class="mt-1 text-xs font-medium text-amber-600"
              >
                {{ daysUntilExpiry(p.subscription.endDate) }} hari lagi
              </p>
              <p
                v-else-if="p.subscription?.endDate && isExpired(p.subscription.endDate)"
                class="mt-1 text-xs font-medium text-red-600"
              >
                Berakhir
              </p>
            </td>
            <!-- <td class="px-4 py-3">
              <p class="max-w-64 text-slate-600">{{ p.bankAccountTujuan }}</p>
            </td> -->
            <td class="px-4 py-3">
              <a
                v-if="p.buktiTransferUrl"
                :href="p.buktiTransferUrl"
                target="_blank"
                class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-700"
              >
                <ExternalLink class="h-3.5 w-3.5" />
                View
              </a>
              <span v-else class="text-xs text-slate-400">No proof</span>
            </td>
            <td class="px-4 py-3">
              <div class="relative inline-flex rounded-xl shadow-sm">
                <Button
                  size="sm"
                  variant="outline"
                  class="rounded-r-none border-r-0"
                  :disabled="saving === p.id"
                  @click="openDetail(p)"
                >
                  <Eye class="h-3.5 w-3.5" />
                  Detail
                </Button>
                <button
                  type="button"
                  class="inline-flex h-8 items-center justify-center rounded-r-xl border border-slate-200 bg-white px-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-50"
                  :disabled="saving === p.id"
                  :aria-expanded="actionMenu === p.id"
                  aria-label="Open payment actions"
                  @click="actionMenu = actionMenu === p.id ? '' : p.id"
                >
                  <MoreHorizontal class="h-4 w-4" />
                </button>

                <div
                  v-if="actionMenu === p.id"
                  class="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                >
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                    @click="openEdit(p)"
                  >
                    <Pencil class="h-3.5 w-3.5" />
                    Edit payment
                  </button>
                  <button
                    v-if="p.status === 'pending'"
                    type="button"
                    class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-green-700 hover:bg-green-50"
                    @click="approve(p.id)"
                  >
                    <CheckCircle2 class="h-3.5 w-3.5" />
                    Approve payment
                  </button>
                  <button
                    v-if="p.status === 'pending'"
                    type="button"
                    class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-amber-700 hover:bg-amber-50"
                    @click="openReject(p)"
                  >
                    <XCircle class="h-3.5 w-3.5" />
                    Reject payment
                  </button>
                  <div class="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                    @click="openDelete(p)"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                    Delete payment
                  </button>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="detailModal.open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      @click.self="closeDetail"
    >
      <Card
        class="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-b-none p-0 shadow-2xl sm:rounded-2xl"
      >
        <div
          class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur"
        >
          <div>
            <h3 class="font-semibold text-slate-900">Payment Details</h3>
            <p class="mt-1 text-xs text-slate-500">
              {{
                detailModal.payment?.user?.email ??
                detailModal.payment?.userId
              }}
            </p>
          </div>
          <Button variant="ghost" size="icon" @click="closeDetail">
            <X class="h-4 w-4" />
          </Button>
        </div>

        <div class="space-y-5 p-5 sm:p-6">
          <div
            class="rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-5 text-white"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p
                  class="text-xs font-medium uppercase tracking-widest text-slate-400"
                >
                  Total Payment
                </p>
                <p class="mt-2 text-3xl font-extrabold">
                  {{ formatCurrency(detailModal.payment?.amount) }}
                </p>
              </div>
              <Badge :variant="badgeVariant(detailModal.payment?.status)">
                {{ detailModal.payment?.status }}
              </Badge>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div
              class="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:col-span-2"
            >
              <div class="flex items-center justify-between gap-3">
                <p
                  class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  <PackageCheck class="h-4 w-4" />
                  Package
                </p>
                <Badge
                  v-if="detailModal.payment?.subscription?.endDate"
                  :variant="isExpired(detailModal.payment.subscription.endDate) ? 'destructive' : 'success'"
                >
                  {{ isExpired(detailModal.payment.subscription.endDate) ? 'Berakhir' : 'Aktif' }}
                </Badge>
              </div>
              <p class="mt-2 font-bold text-slate-900">
                {{
                  detailModal.payment?.subscription?.package?.name ??
                  "No package"
                }}
              </p>
              <div
                v-if="detailModal.payment?.subscription?.endDate"
                class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
              >
                <span
                  v-if="detailModal.payment.subscription.startDate"
                  class="text-slate-500"
                >
                  Mulai: {{ formatEndDate(detailModal.payment.subscription.startDate) }}
                </span>
                <span
                  class="inline-flex items-center gap-1 font-semibold"
                  :class="isExpired(detailModal.payment.subscription.endDate) ? 'text-red-600' : 'text-slate-700'"
                >
                  <CalendarClock class="h-3.5 w-3.5" :class="isExpired(detailModal.payment.subscription.endDate) ? 'text-red-500' : 'text-slate-400'" />
                  Berakhir: {{ formatEndDate(detailModal.payment.subscription.endDate) }}
                </span>
                <span
                  v-if="!isExpired(detailModal.payment.subscription.endDate) && daysUntilExpiry(detailModal.payment.subscription.endDate) <= 7"
                  class="font-medium text-amber-600"
                >
                  ({{ daysUntilExpiry(detailModal.payment.subscription.endDate) }} hari lagi)
                </span>
              </div>
            </div>
            <div class="rounded-xl border border-slate-200 p-4">
              <p
                class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                <Hash class="h-4 w-4" />
                Payment ID
              </p>
              <p class="mt-2 break-all font-mono text-xs font-semibold">
                {{ detailModal.payment?.id }}
              </p>
            </div>
            <div class="rounded-xl border border-slate-200 p-4">
              <p
                class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                <CircleDollarSign class="h-4 w-4" />
                Unique Code
              </p>
              <p class="mt-2 font-bold">
                {{ detailModal.payment?.kodeUnik ?? "-" }}
              </p>
            </div>
            <div
              class="rounded-xl border border-slate-200 p-4 sm:col-span-2"
            >
              <p
                class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                <Building2 class="h-4 w-4" />
                Destination Account
              </p>
              <p class="mt-2 whitespace-pre-line text-sm font-semibold">
                {{ detailModal.payment?.bankAccountTujuan || "-" }}
              </p>
            </div>
            <div class="rounded-xl border border-slate-200 p-4">
              <p
                class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                <CalendarDays class="h-4 w-4" />
                Created
              </p>
              <p class="mt-2 text-sm font-semibold">
                {{ formatDate(detailModal.payment?.createdAt) }}
              </p>
            </div>
            <div class="rounded-xl border border-slate-200 p-4">
              <p
                class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                <CheckCircle2 class="h-4 w-4" />
                Verified
              </p>
              <p class="mt-2 text-sm font-semibold">
                {{ formatDate(detailModal.payment?.verifiedAt) }}
              </p>
            </div>
          </div>

          <div
            v-if="detailModal.payment?.rejectionReason"
            class="rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <p class="text-xs font-semibold uppercase text-red-700">
              Rejection Reason
            </p>
            <p class="mt-2 text-sm text-red-700">
              {{ detailModal.payment.rejectionReason }}
            </p>
          </div>

          <div
            class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end"
          >
            <Button variant="outline" @click="closeDetail">Close</Button>
            <a
              v-if="detailModal.payment?.buktiTransferUrl"
              :href="detailModal.payment.buktiTransferUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700"
            >
              <ExternalLink class="h-4 w-4" />
              View Proof
            </a>
          </div>
        </div>
      </Card>
    </div>

    <div
      v-if="editModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="closeEdit"
    >
      <Card class="max-h-[90vh] w-full max-w-2xl overflow-auto p-0 shadow-2xl">
        <div
          class="flex items-center justify-between border-b border-slate-100 px-5 py-4"
        >
          <div>
            <h3 class="font-semibold text-slate-900">Edit Payment</h3>
            <p class="mt-1 text-xs text-slate-500">
              {{ editModal.payment?.user?.email ?? editModal.payment?.userId }}
            </p>
          </div>
          <Button variant="ghost" size="icon" @click="closeEdit">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <form
          class="grid gap-4 p-5 md:grid-cols-2"
          @submit.prevent="savePayment"
        >
          <div>
            <label
              class="mb-1 block text-xs font-medium uppercase text-slate-500"
              >Amount</label
            >
            <input
              v-model="editForm.amount"
              required
              inputmode="numeric"
              class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label
              class="mb-1 block text-xs font-medium uppercase text-slate-500"
              >Kode Unik</label
            >
            <input
              v-model.number="editForm.kodeUnik"
              required
              type="number"
              min="0"
              class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </div>
          <div class="md:col-span-2">
            <label
              class="mb-1 block text-xs font-medium uppercase text-slate-500"
              >Bank Account</label
            >
            <input
              v-model="editForm.bankAccountTujuan"
              required
              class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label
              class="mb-1 block text-xs font-medium uppercase text-slate-500"
              >Proof URL</label
            >
            <input
              v-model="editForm.buktiTransferUrl"
              class="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label
              class="mb-1 block text-xs font-medium uppercase text-slate-500"
              >Status</label
            >
            <select
              v-model="editForm.status"
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="pending">pending</option>
              <option value="paid">paid</option>
              <option value="rejected">rejected</option>
            </select>
          </div>
          <div class="md:col-span-2">
            <label
              class="mb-1 block text-xs font-medium uppercase text-slate-500"
              >Rejection Reason</label
            >
            <textarea
              v-model="editForm.rejectionReason"
              rows="3"
              class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div class="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="outline" @click="closeEdit"
              >Cancel</Button
            >
            <Button type="submit" :disabled="saving === editModal.payment?.id">
              <Loader2
                v-if="saving === editModal.payment?.id"
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
      v-if="rejectModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="closeReject"
    >
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-0 shadow-2xl">
        <div
          class="flex items-center justify-between border-b border-slate-100 px-5 py-4"
        >
          <div>
            <h3 class="font-semibold text-slate-900">Reject Payment</h3>
            <p class="mt-1 text-xs text-slate-500">
              Explain why this payment cannot be approved.
            </p>
          </div>
          <Button variant="ghost" size="icon" @click="closeReject">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <form class="p-5" @submit.prevent="rejectPayment">
          <label
            class="mb-1.5 block text-xs font-medium uppercase text-slate-500"
          >
            Rejection reason
          </label>
          <textarea
            v-model="rejectModal.reason"
            required
            rows="4"
            placeholder="Example: Transfer amount does not match the order."
            class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <div class="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" @click="closeReject">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              :disabled="saving === rejectModal.payment?.id"
            >
              <Loader2
                v-if="saving === rejectModal.payment?.id"
                class="h-4 w-4 animate-spin"
              />
              <XCircle v-else class="h-4 w-4" />
              Reject
            </Button>
          </div>
        </form>
      </Card>
    </div>

    <div
      v-if="deleteModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="closeDelete"
    >
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-5 shadow-2xl">
        <div class="flex items-start gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"
          >
            <Trash2 class="h-5 w-5" />
          </div>
          <div>
            <h3 class="font-semibold text-slate-900">Delete Payment</h3>
            <p class="mt-2 text-sm text-slate-500">
              Delete payment Rp
              {{ Number(deleteModal.payment?.amount ?? 0).toLocaleString() }}
              for
              {{
                deleteModal.payment?.user?.email ?? deleteModal.payment?.userId
              }}?
            </p>
          </div>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <Button variant="outline" @click="closeDelete">Cancel</Button>
          <Button
            variant="destructive"
            :disabled="saving === deleteModal.payment?.id"
            @click="deletePayment"
          >
            <Loader2
              v-if="saving === deleteModal.payment?.id"
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
