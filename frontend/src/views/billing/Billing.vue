<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBillingStore } from '../../stores/billing'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import ChoosePackage from './ChoosePackage.vue'
import PaymentHistory from './PaymentHistory.vue'
import { CreditCard, ReceiptText, Crown, CalendarClock, Sparkles } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const store = useBillingStore()

const tabs = [
  { key: 'billing', label: 'Paket & Langganan', icon: CreditCard },
  { key: 'payment', label: 'Riwayat Pembayaran', icon: ReceiptText },
]

const activeTab = computed(() => (route.query.tab === 'payment' ? 'payment' : 'billing'))

function setTab(key) {
  router.replace({ query: { ...route.query, tab: key === 'billing' ? undefined : key } })
}

// Load subscription so the summary header is populated regardless of active tab.
onMounted(() => store.fetchSubscription())

const sub = computed(() => store.subscription)
const daysRemaining = computed(() => {
  if (!sub.value?.endDate) return null
  const diff = Math.ceil((new Date(sub.value.endDate) - new Date()) / 86400000)
  return diff >= 0 ? diff : 0
})
const isActive = computed(() => daysRemaining.value !== null && daysRemaining.value > 0)

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div>
      <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">Billing</h2>
      <p class="mt-1.5 text-sm text-slate-500">Kelola paket langganan dan riwayat pembayaran Anda.</p>
    </div>

    <!-- Subscription summary card -->
    <Card class="overflow-hidden p-0">
      <div class="relative bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white sm:p-7">
        <!-- decorative glow -->
        <div class="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-500/20 blur-3xl" />

        <div class="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start gap-4">
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg"
              :class="isActive ? 'bg-linear-to-br from-primary-400 to-primary-600 shadow-primary-500/30' : 'bg-slate-700'"
            >
              <Crown class="h-6 w-6" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <p class="text-xs font-medium uppercase tracking-widest text-slate-400">Paket Aktif</p>
                <Badge v-if="isActive" variant="success">Active</Badge>
                <Badge v-else variant="destructive">Expired</Badge>
              </div>
              <h3 class="mt-1 text-2xl font-extrabold tracking-tight">
                {{ sub?.package?.name ?? 'Belum berlangganan' }}
              </h3>
              <p v-if="sub?.endDate" class="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-300">
                <CalendarClock class="h-3.5 w-3.5" />
                Berakhir {{ formatDate(sub.endDate) }}
              </p>
            </div>
          </div>

          <!-- Days remaining gauge -->
          <div v-if="daysRemaining !== null" class="shrink-0 rounded-2xl bg-white/10 px-5 py-4 backdrop-blur-sm ring-1 ring-white/15">
            <p class="text-xs font-medium uppercase tracking-widest text-slate-400">Sisa hari</p>
            <p class="mt-1 text-3xl font-extrabold tabular-nums">{{ daysRemaining }}</p>
          </div>
          <div v-else class="shrink-0">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-all duration-200 hover:bg-slate-100"
              @click="setTab('billing')"
            >
              <Sparkles class="h-4 w-4 text-primary" />
              Pilih Paket
            </button>
          </div>
        </div>

        <!-- progress bar -->
        <div v-if="sub?.startDate && sub?.endDate" class="relative mt-6">
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-linear-to-r from-primary-400 to-primary-600 transition-all duration-500"
              :style="{ width: Math.max(4, 100 - (daysRemaining / Math.max(1, (new Date(sub.endDate) - new Date(sub.startDate)) / 86400000)) * 100) + '%' }"
            />
          </div>
        </div>
      </div>
    </Card>

    <!-- Tabs -->
    <div class="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 sm:inline-flex sm:w-auto">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        @click="setTab(tab.key)"
        :class="[
          'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 sm:flex-none',
          activeTab === tab.key
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-900',
        ]"
      >
        <component :is="tab.icon" class="h-4 w-4" />
        <span class="hidden sm:inline">{{ tab.label }}</span>
        <span class="sm:hidden">{{ tab.key === 'billing' ? 'Paket' : 'Pembayaran' }}</span>
      </button>
    </div>

    <!-- Tab content -->
    <ChoosePackage v-if="activeTab === 'billing'" />
    <PaymentHistory v-else />
  </div>
</template>
