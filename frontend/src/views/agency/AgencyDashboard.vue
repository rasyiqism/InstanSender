<script setup>
import { onMounted, ref } from 'vue'
import { useAgencyStore } from '../../stores/agency'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Alert from '../../components/ui/Alert.vue'
import { Loader2, Users, Smartphone, CheckCircle2, XCircle, RefreshCw, KeyRound } from 'lucide-vue-next'

const store = useAgencyStore()
const error = ref('')
const loading = ref(false)

onMounted(() => load())

async function load() {
  loading.value = true
  error.value = ''
  try {
    await store.fetchDashboard()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal memuat dashboard'
  } finally {
    loading.value = false
  }
}

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'
}

function quotaPercent(used, total) {
  if (!total) return 0
  return Math.round((used / total) * 100)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">Agency Dashboard</h2>
        <p class="mt-1.5 text-sm text-slate-500">Ringkasan reseller agency Anda.</p>
      </div>
      <button class="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100" @click="load">
        <RefreshCw class="h-4 w-4" :class="loading ? 'animate-spin' : ''" />
        Refresh
      </button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div v-if="loading && !store.dashboard" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Memuat...</span>
    </div>

    <template v-else-if="store.dashboard">
      <!-- Stats cards -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card class="p-5">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <Users class="h-5 w-5" />
            </div>
            <div>
              <p class="text-2xl font-bold text-slate-900">{{ store.dashboard.stats.totalUsers }}</p>
              <p class="text-xs text-slate-500">Total Users</p>
            </div>
          </div>
        </Card>

        <Card class="p-5">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <CheckCircle2 class="h-5 w-5" />
            </div>
            <div>
              <p class="text-2xl font-bold text-slate-900">{{ store.dashboard.stats.activeUsers }}</p>
              <p class="text-xs text-slate-500">Active Users</p>
            </div>
          </div>
        </Card>

        <Card class="p-5">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <XCircle class="h-5 w-5" />
            </div>
            <div>
              <p class="text-2xl font-bold text-slate-900">{{ store.dashboard.stats.suspendedUsers }}</p>
              <p class="text-xs text-slate-500">Suspended</p>
            </div>
          </div>
        </Card>

        <Card class="p-5">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <KeyRound class="h-5 w-5" />
            </div>
            <div>
              <p class="text-2xl font-bold text-slate-900">{{ store.dashboard.subscription?.activationsLeft ?? '-' }}</p>
              <p class="text-xs text-slate-500">Sisa Aktivasi</p>
            </div>
          </div>
        </Card>
      </div>

      <!-- Subscription detail -->
      <Card class="p-5" v-if="store.dashboard.subscription">
        <h3 class="mb-4 text-sm font-bold text-slate-900">Agency Package</h3>
        <div class="mb-4">
          <div class="mb-2 flex items-center justify-between text-sm">
            <span class="text-slate-500">Kuota Aktivasi</span>
            <span class="font-medium text-slate-900">{{ store.dashboard.subscription.activationUsed }} / {{ store.dashboard.subscription.activationLimit }}</span>
          </div>
          <div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div class="h-full rounded-full bg-teal-500 transition-all" :style="{ width: quotaPercent(store.dashboard.subscription.activationUsed, store.dashboard.subscription.activationLimit) + '%' }" />
          </div>
          <p class="mt-2 text-xs text-slate-400">{{ store.dashboard.subscription.activationsLeft }} aktivasi tersisa</p>
          <p v-if="store.dashboard.subscription.allowedPackages?.length" class="mt-1 text-xs text-slate-400">
            Paket yang bisa diaktifkan: {{ store.dashboard.subscription.allowedPackages.join(', ') }}
          </p>
        </div>

        <dl class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt class="text-slate-500">Status</dt>
            <dd><Badge :variant="store.dashboard.subscription.status === 'active' ? 'success' : 'warning'">{{ store.dashboard.subscription.status }}</Badge></dd>
          </div>
          <div>
            <dt class="text-slate-500">Mulai</dt>
            <dd class="font-medium text-slate-900">{{ formatDate(store.dashboard.subscription.startsAt) }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Berakhir</dt>
            <dd class="font-medium text-slate-900">{{ formatDate(store.dashboard.subscription.expiresAt) }}</dd>
          </div>
        </dl>
      </Card>
    </template>
  </div>
</template>
