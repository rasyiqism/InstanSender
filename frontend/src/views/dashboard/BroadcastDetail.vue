<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBroadcastStore } from '../../stores/broadcast'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Alert from '../../components/ui/Alert.vue'
import {
  Loader2,
  ArrowLeft,
  Megaphone,
  RefreshCw,
  Clock,
  Image as ImageIcon,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const store = useBroadcastStore()

const id = route.params.id
const broadcast = ref(null)
const error = ref('')
let pollTimer = null

const progressPercent = computed(() => {
  if (!broadcast.value?.totalRecipients) return 0
  return Math.round(
    ((broadcast.value.sentCount + broadcast.value.failedCount) /
      broadcast.value.totalRecipients) *
      100,
  )
})

const isDone = computed(
  () => broadcast.value?.status === 'completed' || broadcast.value?.status === 'failed',
)

function statusVariant(status) {
  switch (status) {
    case 'completed': return 'success'
    case 'running': return 'warning'
    case 'failed': return 'destructive'
    default: return 'secondary'
  }
}

function statusLabel(status) {
  const map = { pending: 'Pending', running: 'Berjalan', completed: 'Selesai', failed: 'Gagal' }
  return map[status] || status
}

const isScheduled = computed(
  () => broadcast.value?.scheduledAt && broadcast.value?.status === 'pending',
)

async function load() {
  error.value = ''
  try {
    broadcast.value = await store.getBroadcast(id)
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal memuat broadcast'
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    await load()
    if (isDone.value) stopPolling()
  }, 3000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(async () => {
  await load()
  // poll while running OR while scheduled-pending (waiting for trigger to fire)
  if (!isDone.value) startPolling()
})

onUnmounted(stopPolling)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" @click="router.push('/broadcasts')">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-3">
          <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
            Detail Broadcast
          </h2>
          <Badge v-if="broadcast" :variant="statusVariant(broadcast.status)">
            {{ statusLabel(broadcast.status) }}
          </Badge>
        </div>
        <p v-if="broadcast" class="mt-1 text-sm text-slate-500">
          {{ new Date(broadcast.createdAt).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }) }}
        </p>
      </div>
      <Button variant="outline" size="icon" @click="load">
        <RefreshCw class="h-4 w-4" :class="broadcast?.status === 'running' ? 'animate-spin' : ''" />
      </Button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div v-if="!broadcast" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Memuat...</span>
    </div>

    <template v-else>
      <!-- Message -->
      <Card class="p-5">
        <div class="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
          <Megaphone class="h-4 w-4" />
          {{ broadcast.type === 'image' ? 'Gambar' : 'Pesan' }}
        </div>
        <template v-if="broadcast.type === 'image'">
          <img
            :src="broadcast.mediaUrl"
            :alt="broadcast.caption || 'Broadcast image'"
            class="mb-3 max-h-64 rounded-xl border border-slate-100 object-contain"
            @error="$event.target.style.display = 'none'"
          >
          <p v-if="broadcast.caption" class="whitespace-pre-wrap break-words text-sm text-slate-900">{{ broadcast.caption }}</p>
          <p class="mt-2 break-all text-xs text-slate-400">{{ broadcast.mediaUrl }}</p>
        </template>
        <p v-else class="whitespace-pre-wrap break-words text-sm text-slate-900">{{ broadcast.message }}</p>
      </Card>

      <!-- Progress -->
      <Card class="p-5">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-900">Progress</h3>
          <span class="text-sm font-medium text-slate-500">{{ progressPercent }}%</span>
        </div>

        <div class="mb-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="broadcast.status === 'failed' ? 'bg-red-400' : 'bg-primary'"
            :style="{ width: progressPercent + '%' }"
          />
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-xl bg-primary-50 p-4 text-center">
            <p class="text-2xl font-bold text-primary">{{ broadcast.sentCount }}</p>
            <p class="mt-1 text-xs font-medium text-primary-700">Terkirim</p>
          </div>
          <div class="rounded-xl bg-red-50 p-4 text-center">
            <p class="text-2xl font-bold text-red-600">{{ broadcast.failedCount }}</p>
            <p class="mt-1 text-xs font-medium text-red-700">Gagal</p>
          </div>
          <div class="rounded-xl bg-slate-100 p-4 text-center">
            <p class="text-2xl font-bold text-slate-700">{{ broadcast.totalRecipients }}</p>
            <p class="mt-1 text-xs font-medium text-slate-500">Total</p>
          </div>
        </div>
      </Card>

      <!-- Info -->
      <Card class="p-5">
        <h3 class="mb-3 text-sm font-bold text-slate-900">Informasi</h3>
        <dl class="space-y-2 text-sm">
          <div v-if="broadcast.scheduledAt" class="flex justify-between">
            <dt class="text-slate-500">Terjadwal pada</dt>
            <dd class="font-medium text-primary-600">
              {{ new Date(broadcast.scheduledAt).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }) }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Delay antar penerima</dt>
            <dd class="font-medium text-slate-900">{{ broadcast.delaySeconds }} detik</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Estimasi selesai</dt>
            <dd class="font-medium text-slate-900">
              {{ broadcast.status === 'running'
                ? '~' + Math.ceil((broadcast.totalRecipients * broadcast.delaySeconds) / 60) + ' menit'
                : isScheduled
                  ? 'Menunggu jadwal'
                  : 'Selesai' }}
            </dd>
          </div>
        </dl>
      </Card>

      <Alert v-if="isScheduled" variant="info">
        <Clock class="h-4 w-4" />
        Broadcast terjadwal. Akan dimulai otomatis pada waktu yang ditentukan.
      </Alert>
      <Alert v-else-if="broadcast.status === 'running'" variant="info">
        <Loader2 class="h-4 w-4 animate-spin" />
        Broadcast sedang berjalan. Progress diperbarui otomatis setiap 3 detik.
      </Alert>
    </template>
  </div>
</template>
