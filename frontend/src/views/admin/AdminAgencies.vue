<script setup>
import { onMounted, ref } from 'vue'
import { useAgencyStore } from '../../stores/agency'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Button from '../../components/ui/Button.vue'
import Alert from '../../components/ui/Alert.vue'
import { Loader2, RefreshCw } from 'lucide-vue-next'

const store = useAgencyStore()
const error = ref('')
const loading = ref(false)

onMounted(() => load())

async function load() {
  loading.value = true
  error.value = ''
  try {
    await store.adminFetchAgencies()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal memuat'
  } finally {
    loading.value = false
  }
}

async function activate(id) {
  error.value = ''
  try {
    await store.adminActivateAgency(id)
    await load()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal aktivasi'
  }
}

async function suspend(id) {
  error.value = ''
  try {
    await store.adminSuspendAgency(id)
    await load()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal suspend'
  }
}

function statusVariant(s) {
  return { active: 'success', trial: 'warning', suspended: 'destructive', expired: 'secondary', cancelled: 'secondary' }[s] || 'secondary'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Agencies</h2>
        <p class="mt-1 text-sm text-slate-500">Kelola semua agency reseller terdaftar.</p>
      </div>
      <Button variant="outline" size="sm" @click="load">
        <RefreshCw class="h-3.5 w-3.5" :class="loading ? 'animate-spin' : ''" />
        <span>Muat Ulang</span>
      </Button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div v-if="loading && !store.agencies.length" class="flex items-center justify-center py-16">
      <Loader2 class="h-6 w-6 animate-spin text-slate-700" />
    </div>

    <Card v-else-if="!store.agencies.length" class="flex flex-col items-center p-12 text-center">
      <p class="text-base font-bold text-slate-900">Belum ada agency</p>
      <p class="mt-1 text-xs text-slate-500">Agency yang mendaftar akan muncul di tabel ini.</p>
    </Card>

    <Card v-else class="overflow-hidden p-0">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-5 py-3.5">Agency</th>
              <th class="px-5 py-3.5">Owner</th>
              <th class="px-5 py-3.5">Status</th>
              <th class="px-5 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="a in store.agencies" :key="a.id" class="transition-colors hover:bg-slate-50/60">
              <td class="px-5 py-3.5">
                <p class="font-semibold text-slate-900 tracking-tight">{{ a.name }}</p>
                <p class="font-mono text-xs text-slate-400 tracking-wider">{{ a.id?.substring(0, 8) }}</p>
              </td>
              <td class="px-5 py-3.5">
                <p class="font-mono text-xs text-slate-700">{{ a.owner?.email || '-' }}</p>
                <p v-if="a.owner?.name" class="text-xs text-slate-400">{{ a.owner.name }}</p>
              </td>
              <td class="px-5 py-3.5">
                <Badge :variant="statusVariant(a.status)">{{ a.status }}</Badge>
              </td>
              <td class="px-5 py-3.5 text-right">
                <button
                  v-if="a.status !== 'active'"
                  class="rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 active:scale-95 transition-all cursor-pointer"
                  @click="activate(a.id)"
                >
                  Aktivasi
                </button>
                <button
                  v-if="a.status === 'active'"
                  class="rounded-lg px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 active:scale-95 transition-all cursor-pointer"
                  @click="suspend(a.id)"
                >
                  Suspend
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  </div>
</template>
