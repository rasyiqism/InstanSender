<script setup>
import { onMounted, ref, computed } from 'vue'
import {
  Smartphone,
  Send,
  Crown,
  ArrowRight,
  Activity,
  KeyRound,
  CreditCard,
  Plus,
  TrendingUp,
} from 'lucide-vue-next'
import { useDeviceStore } from '../../stores/device'
import { useBillingStore } from '../../stores/billing'
import api from '../../services/api'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Button from '../../components/ui/Button.vue'

const deviceStore = useDeviceStore()
const billingStore = useBillingStore()
const logCount = ref(0)
const loading = ref(true)

onMounted(async () => {
  try {
    await Promise.all([deviceStore.fetch(), billingStore.fetchSubscription()])
    const { data } = await api.get('/logs?limit=1')
    logCount.value = data.pagination?.total ?? 0
  } catch {
    /* ignore */
  } finally {
    loading.value = false
  }
})

const activeDevices = computed(
  () => (deviceStore.devices || []).filter((d) => d && d.status === 'connected').length,
)

function badgeVariant(status) {
  if (status === 'connected') return 'success'
  if (status === 'pending_qr') return 'warning'
  return 'destructive'
}

function badgeLabel(status) {
  if (status === 'connected') return 'Connected'
  if (status === 'pending_qr') return 'Pending QR'
  return 'Offline'
}

const quickActions = [
  { to: '/devices', label: 'Tambah Perangkat', icon: Plus, desc: 'Tautkan nomor WhatsApp' },
  { to: '/api-keys', label: 'API Keys', icon: KeyRound, desc: 'Kelola token integrasi' },
  { to: '/billing', label: 'Billing', icon: CreditCard, desc: 'Paket & langganan' },
]
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Dashboard</h2>
        <p class="mt-1 text-sm text-slate-500">Monitoring status perangkat, antrean pesan, dan langganan aktif.</p>
      </div>
      <router-link to="/devices">
        <Button class="gap-1.5">
          <Plus class="h-4 w-4" />
          <span>Tambah</span>
        </Button>
      </router-link>
    </div>

    <!-- Quick Action Cards (Tactile micro-interaction) -->
    <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
      <router-link
        v-for="a in quickActions"
        :key="a.to"
        :to="a.to"
        class="group flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all duration-150 ease-out hover:border-slate-300 hover:scale-[1.01] active:scale-[0.98]"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800 transition-colors group-hover:bg-slate-900 group-hover:text-white">
          <component :is="a.icon" class="h-5 w-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold text-slate-900 tracking-tight">{{ a.label }}</p>
          <p class="truncate text-xs text-slate-500">{{ a.desc }}</p>
        </div>
        <ArrowRight class="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-900 group-hover:translate-x-0.5" />
      </router-link>
    </div>

    <!-- Stats Cards (Mobile Horizontal Rail, Desktop Bento Grid) -->
    <div class="flex overflow-x-auto gap-4 pb-2 snap-x sm:grid sm:grid-cols-3 sm:pb-0">
      <!-- Active Devices Card -->
      <Card class="min-w-[260px] flex-1 snap-start p-5 sm:p-6 transition-all duration-150">
        <div class="flex items-center justify-between">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Active Devices</p>
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Smartphone class="h-4 w-4" />
          </div>
        </div>
        <p class="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
          {{ activeDevices }}
        </p>
        <p class="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 font-mono">
          <TrendingUp class="h-3.5 w-3.5 text-emerald-500" />
          {{ deviceStore.devices.length }} total slot
        </p>
      </Card>

      <!-- Total Messages Card -->
      <Card class="min-w-[260px] flex-1 snap-start p-5 sm:p-6 transition-all duration-150">
        <div class="flex items-center justify-between">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Total Messages</p>
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Send class="h-4 w-4" />
          </div>
        </div>
        <p class="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
          {{ logCount.toLocaleString('id-ID') }}
        </p>
        <p class="mt-1.5 text-xs text-slate-400 font-mono">
          Pesan terkirim via gateway
        </p>
      </Card>

      <!-- Subscription Plan Card -->
      <Card class="min-w-[260px] flex-1 snap-start p-5 sm:p-6 transition-all duration-150">
        <div class="flex items-center justify-between">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Langganan</p>
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Crown class="h-4 w-4" />
          </div>
        </div>
        <div class="mt-4 flex items-center gap-2">
          <Badge :variant="billingStore.subscription?.status === 'active' ? 'success' : 'warning'">
            {{ billingStore.subscription?.package?.name ?? (billingStore.subscription ? 'Aktif' : 'Gratis / Belum Ada') }}
          </Badge>
        </div>
        <p v-if="billingStore.subscription?.endDate" class="mt-2 text-xs text-slate-500 font-mono">
          Berlaku hingga {{ new Date(billingStore.subscription.endDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) }}
        </p>
        <p v-else class="mt-2 text-xs text-slate-400">
          Tingkatkan paket untuk kuota lebih
        </p>
      </Card>
    </div>

    <!-- Connected Devices List (Hairline table format) -->
    <Card class="overflow-hidden p-0">
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/50">
        <div>
          <h3 class="text-sm font-bold tracking-tight text-slate-900 uppercase tracking-wider">Perangkat Terdaftar</h3>
          <p class="text-xs text-slate-500">Nomor WhatsApp yang tersinkronisasi.</p>
        </div>
        <router-link to="/devices">
          <Button variant="outline" size="sm" class="gap-1">
            <span>Kelola</span>
            <ArrowRight class="h-3.5 w-3.5" />
          </Button>
        </router-link>
      </div>

      <div v-if="!deviceStore.devices.length" class="flex flex-col items-center p-12 text-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
          <Smartphone class="h-6 w-6" />
        </div>
        <p class="text-sm font-bold text-slate-800">Belum ada perangkat terhubung</p>
        <p class="mt-1 text-xs text-slate-500 max-w-xs">
          Tautkan akun WhatsApp Anda melalui scan QR code untuk mulai mengirim pesan.
        </p>
        <router-link to="/devices" class="mt-4">
          <Button size="sm">Tambah Perangkat</Button>
        </router-link>
      </div>

      <div v-else class="divide-y divide-slate-100">
        <div
          v-for="d in (deviceStore.devices || []).filter((d) => d && d.id)"
          :key="d.id"
          class="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-slate-50/60"
        >
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">
              WA
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-900 tracking-tight">{{ d.name }}</p>
              <p class="text-xs font-mono text-slate-500 tracking-wider">
                {{ d.phoneNumber || 'Menunggu pemindaian QR…' }}
              </p>
            </div>
          </div>
          <Badge :variant="badgeVariant(d.status)">{{ badgeLabel(d.status) }}</Badge>
        </div>
      </div>
    </Card>
  </div>
</template>
