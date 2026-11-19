<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBillingStore } from '../../stores/billing'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import {
  Building2,
  ChevronRight,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Hash,
  PackageCheck,
  Loader2,
  ReceiptText,
  ShieldCheck,
  X,
} from 'lucide-vue-next'

const store = useBillingStore()
const router = useRouter()
const selectedPayment = ref(null)
const copied = ref('')

// Summary stats for the chips above the list.
const paidCount = computed(() => store.payments.filter((p) => p.status === 'paid' || p.status === 'approved').length)
const totalPaid = computed(() =>
  store.payments
    .filter((p) => p.status === 'paid' || p.status === 'approved')
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
)

onMounted(() => store.fetchPayments())
onUnmounted(() => {
  document.body.style.overflow = ''
})

function statusVariant(status) {
  if (status === 'paid' || status === 'approved') return 'success'
  if (status === 'pending') return 'warning'
  return 'destructive'
}

function statusLabel(status) {
  if (status === 'paid' || status === 'approved') return 'Paid'
  if (status === 'pending') return 'Pending'
  if (status === 'rejected') return 'Rejected'
  return status
}

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0))
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value))
}

function openDetail(payment) {
  selectedPayment.value = payment
}

function closeDetail() {
  selectedPayment.value = null
  copied.value = ''
}

async function copyValue(label, value) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(String(value))
    copied.value = label
    window.setTimeout(() => {
      if (copied.value === label) copied.value = ''
    }, 1600)
  } catch {
    copied.value = ''
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape' && selectedPayment.value) closeDetail()
}

watch(
  selectedPayment,
  (payment) => {
    document.body.style.overflow = payment ? 'hidden' : ''
  },
)

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div v-if="store.loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Loading payments...</span>
    </div>

    <!-- Empty State -->
    <Card v-else-if="!store.payments.length" class="flex flex-col items-center p-12 text-center">
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
        <ReceiptText class="h-7 w-7" />
      </div>
      <p class="text-lg font-bold text-slate-900">Belum ada pembayaran</p>
      <p class="mt-1 text-sm text-slate-500">
        Pilih paket untuk memulai langganan Anda.
      </p>
      <Button class="mt-5" @click="router.push('/billing')">Pilih Paket</Button>
    </Card>

    <!-- Payment List -->
    <template v-else>
      <!-- Summary chips -->
      <div class="flex flex-wrap items-center gap-2">
        <Badge variant="success">{{ paidCount }} Transaksi Sukses</Badge>
        <Badge variant="secondary">Total {{ formatCurrency(totalPaid) }}</Badge>
      </div>

      <div class="space-y-3">
        <Card
          v-for="p in store.payments"
          :key="p.id"
          class="group overflow-hidden p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <button
            type="button"
            class="flex w-full flex-col gap-3 p-5 text-left transition-colors hover:bg-slate-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:flex-row sm:items-center sm:justify-between"
            @click="openDetail(p)"
          >
            <div class="flex items-center gap-4">
              <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors duration-200 group-hover:bg-primary-50 group-hover:text-primary">
                <ReceiptText class="h-5 w-5" />
              </div>
              <div class="min-w-0">
                <p class="font-bold text-slate-900">{{ formatCurrency(p.amount) }}</p>
                <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  <span>{{ formatDate(p.createdAt) }}</span>
                  <span v-if="p.subscription?.package?.name" class="inline-flex items-center gap-1">
                    <PackageCheck class="h-3 w-3 text-slate-400" />
                    {{ p.subscription.package.name }}
                  </span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-3 self-end sm:self-auto">
              <Badge :variant="statusVariant(p.status)">{{ statusLabel(p.status) }}</Badge>
              <ChevronRight class="h-4 w-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
          </button>
        </Card>
      </div>
    </template>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="selectedPayment"
          class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-detail-title"
          @click.self="closeDetail"
        >
          <Card class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none border-0 p-0 shadow-2xl sm:rounded-2xl">
            <div class="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
              <div class="flex items-center gap-3">
                <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <ReceiptText class="h-5 w-5" />
                </div>
                <div>
                  <h3 id="payment-detail-title" class="font-bold text-slate-900">Payment details</h3>
                  <p class="mt-0.5 text-xs text-slate-500">Complete transaction information</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close payment details" @click="closeDetail">
                <X class="h-5 w-5" />
              </Button>
            </div>

            <div class="space-y-6 p-5 sm:p-6">
              <div class="overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-5 text-white shadow-lg shadow-slate-200">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="text-xs font-medium uppercase tracking-widest text-slate-400">Total payment</p>
                    <p class="mt-2 text-3xl font-extrabold tracking-tight">{{ formatCurrency(selectedPayment.amount) }}</p>
                  </div>
                  <Badge :variant="statusVariant(selectedPayment.status)">
                    {{ statusLabel(selectedPayment.status) }}
                  </Badge>
                </div>
                <div class="mt-5 border-t border-white/10 pt-4">
                  <p class="text-xs text-slate-400">Created at</p>
                  <p class="mt-1 text-sm font-medium text-slate-100">{{ formatDate(selectedPayment.createdAt) }}</p>
                </div>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:col-span-2">
                  <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <PackageCheck class="h-4 w-4" />
                    Package
                  </div>
                  <p class="mt-2 font-bold text-slate-900">
                    {{ selectedPayment.subscription?.package?.name || '-' }}
                  </p>
                </div>

                <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <Hash class="h-4 w-4" />
                    Order ID
                  </div>
                  <div class="mt-2 flex items-center justify-between gap-2">
                    <p class="min-w-0 truncate font-mono text-xs font-semibold text-slate-800">{{ selectedPayment.id }}</p>
                    <button
                      type="button"
                      class="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-primary"
                      aria-label="Copy order ID"
                      @click="copyValue('id', selectedPayment.id)"
                    >
                      <Copy class="h-4 w-4" />
                    </button>
                  </div>
                  <p v-if="copied === 'id'" class="mt-1 text-xs font-medium text-primary">Copied</p>
                </div>

                <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <CircleDollarSign class="h-4 w-4" />
                    Unique code
                  </div>
                  <p class="mt-2 font-bold text-slate-900">{{ selectedPayment.kodeUnik ?? '-' }}</p>
                </div>

                <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:col-span-2">
                  <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <Building2 class="h-4 w-4" />
                    Destination account
                  </div>
                  <div class="mt-2 flex items-start justify-between gap-3">
                    <p class="whitespace-pre-line text-sm font-semibold leading-6 text-slate-800">
                      {{ selectedPayment.bankAccountTujuan || '-' }}
                    </p>
                    <button
                      v-if="selectedPayment.bankAccountTujuan"
                      type="button"
                      class="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-primary"
                      aria-label="Copy destination account"
                      @click="copyValue('bank', selectedPayment.bankAccountTujuan)"
                    >
                      <Copy class="h-4 w-4" />
                    </button>
                  </div>
                  <p v-if="copied === 'bank'" class="mt-1 text-xs font-medium text-primary">Copied</p>
                </div>
              </div>

              <div
                v-if="selectedPayment.rejectionReason"
                class="rounded-xl border border-red-200 bg-red-50 p-4"
              >
                <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-700">
                  <ShieldCheck class="h-4 w-4" />
                  Rejection reason
                </div>
                <p class="mt-2 text-sm leading-6 text-red-700">{{ selectedPayment.rejectionReason }}</p>
              </div>

              <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <Button variant="outline" @click="closeDetail">Close</Button>
                <a
                  v-if="selectedPayment.buktiTransferUrl"
                  :href="selectedPayment.buktiTransferUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
                >
                  <ExternalLink class="h-4 w-4" />
                  View transfer proof
                </a>
              </div>
            </div>
          </Card>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
