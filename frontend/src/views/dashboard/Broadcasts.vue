<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBroadcastStore } from '../../stores/broadcast'
import { useDeviceStore } from '../../stores/device'
import { useTextareaInsert } from '../../composables/useTextareaInsert'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Alert from '../../components/ui/Alert.vue'
import EmojiPicker from '../../components/ui/EmojiPicker.vue'
import {
  Loader2,
  Plus,
  Megaphone,
  X,
  ChevronRight,
  Image as ImageIcon,
  MessageSquare,
} from 'lucide-vue-next'

const store = useBroadcastStore()
const devices = useDeviceStore()
const router = useRouter()
const { onFocus, insertAtCursor } = useTextareaInsert()

const error = ref('')
const saving = ref(false)
const createModal = ref(false)
const form = reactive({
  deviceId: '',
  contactListId: '',
  type: 'text', // 'text' | 'image'
  message: '',
  mediaUrl: '',
  caption: '',
  delaySeconds: 5,
  scheduleMode: 'now', // 'now' | 'schedule'
  scheduledAt: '',
})

onMounted(async () => {
  await Promise.all([store.fetchBroadcasts(), devices.fetch(), store.fetchContactLists()])
  const validDevices = (devices.devices || []).filter((d) => d && d.id)
  if (validDevices.length && !form.deviceId) form.deviceId = validDevices[0].id
})

const canCreate = computed(() => {
  if (!form.deviceId || !form.contactListId || form.delaySeconds < 1) return false
  if (form.type === 'text' && !form.message.trim()) return false
  if (form.type === 'image' && !form.mediaUrl.trim()) return false
  if (form.scheduleMode === 'schedule' && !form.scheduledAt) return false
  return true
})

// default datetime-local to 1 hour from now
function defaultScheduleTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setSeconds(0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function openCreate() {
  form.scheduleMode = 'now'
  form.scheduledAt = defaultScheduleTime()
  createModal.value = true
}

function insertEmoji(emoji) {
  if (form.type === 'text') {
    insertAtCursor(() => form.message, (v) => (form.message = v), emoji)
  } else {
    insertAtCursor(() => form.caption, (v) => (form.caption = v), emoji)
  }
}

function insertName() {
  const get = form.type === 'text' ? () => form.message : () => form.caption
  const set = form.type === 'text' ? (v) => (form.message = v) : (v) => (form.caption = v)
  insertAtCursor(get, set, '{name}')
}

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

async function createBroadcast() {
  if (!canCreate.value) return
  saving.value = true
  error.value = ''
  try {
    const payload = {
      deviceId: form.deviceId,
      contactListId: form.contactListId,
      type: form.type,
      delaySeconds: Number(form.delaySeconds),
    }
    if (form.type === 'text') {
      payload.message = form.message.trim()
    } else {
      payload.mediaUrl = form.mediaUrl.trim()
      if (form.caption.trim()) payload.caption = form.caption.trim()
    }
    if (form.scheduleMode === 'schedule' && form.scheduledAt) {
      payload.scheduledAt = new Date(form.scheduledAt).toISOString()
    }
    const result = await store.createBroadcast(payload)
    createModal.value = false
    form.message = ''
    form.mediaUrl = ''
    form.caption = ''
    router.push(`/broadcasts/${result.id}`)
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal membuat broadcast'
  } finally {
    saving.value = false
  }
}

function progressPercent(b) {
  if (!b.totalRecipients) return 0
  return Math.round(((b.sentCount + b.failedCount) / b.totalRecipients) * 100)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
          Broadcasts
        </h2>
        <p class="mt-1.5 text-sm text-slate-500">
          Kirim pesan massal ke daftar kontak dengan delay antar penerima.
        </p>
      </div>
      <Button @click="openCreate">
        <Plus class="h-4 w-4" />
        Buat Broadcast
      </Button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div v-if="store.loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Memuat...</span>
    </div>

    <Card
      v-else-if="!store.broadcasts.length"
      class="flex flex-col items-center p-12 text-center"
    >
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
        <Megaphone class="h-7 w-7" />
      </div>
      <p class="text-lg font-bold text-slate-900">Belum ada broadcast</p>
      <p class="mt-1 text-sm text-slate-500">
        Buat broadcast untuk mengirim pesan ke daftar kontak.
      </p>
    </Card>

    <div v-else class="space-y-3">
      <Card
        v-for="b in store.broadcasts"
        :key="b.id"
        class="group cursor-pointer overflow-hidden p-0 transition-all duration-200 hover:shadow-md"
        @click="router.push(`/broadcasts/${b.id}`)"
      >
        <div class="p-5">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <Badge :variant="statusVariant(b.status)">{{ statusLabel(b.status) }}</Badge>
                <Badge v-if="b.scheduledAt && b.status === 'pending'" variant="info">Terjadwal</Badge>
                <span class="text-xs text-slate-400">
                  {{ new Date(b.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) }}
                </span>
              </div>
              <p v-if="b.scheduledAt" class="mt-1 text-xs text-primary-600">
                Mulai: {{ new Date(b.scheduledAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) }}
              </p>
              <p class="mt-2 line-clamp-2 text-sm font-medium text-slate-900">
                <span v-if="b.type === 'image'" class="mr-1 inline-flex items-center gap-1 text-primary-600">
                  <ImageIcon class="h-3.5 w-3.5" />
                </span>{{ b.type === 'image' ? (b.caption || b.mediaUrl) : b.message }}
              </p>
              <div class="mt-2 flex items-center gap-3 text-xs text-slate-500">
                <span>{{ b.sentCount }} terkirim</span>
                <span>{{ b.failedCount }} gagal</span>
                <span>/ {{ b.totalRecipients }} total</span>
                <span>·</span>
                <span>{{ b.delaySeconds }}s delay</span>
              </div>
            </div>
            <ChevronRight class="h-5 w-5 shrink-0 text-slate-300" />
          </div>
          <!-- progress bar -->
          <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="b.status === 'failed' ? 'bg-red-400' : 'bg-primary'"
              :style="{ width: progressPercent(b) + '%' }"
            />
          </div>
        </div>
      </Card>
    </div>

    <!-- Create broadcast modal -->
    <div
      v-if="createModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="createModal = false"
    >
      <Card class="max-h-[90vh] w-full max-w-lg overflow-y-auto p-0 shadow-2xl">
        <div class="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h3 class="font-semibold text-slate-900">Buat Broadcast</h3>
          <Button variant="ghost" size="icon" @click="createModal = false">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="space-y-4 p-5">
          <label class="space-y-1.5">
            <span class="text-sm font-medium text-slate-700">Device Pengirim</span>
            <select
              v-model="form.deviceId"
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option v-for="d in (devices.devices || []).filter((d) => d && d.id)" :key="d.id" :value="d.id">
                {{ d.name }}{{ d.phoneNumber ? ` (${d.phoneNumber})` : '' }}
              </option>
            </select>
          </label>

          <label class="space-y-1.5">
            <span class="text-sm font-medium text-slate-700">Contact List</span>
            <select
              v-model="form.contactListId"
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="" disabled>Pilih contact list...</option>
              <option v-for="l in store.contactLists" :key="l.id" :value="l.id">
                {{ l.name }} ({{ l.contactCount }} kontak)
              </option>
            </select>
            <p v-if="!store.contactLists.length" class="text-xs text-amber-600">
              Belum ada contact list. Buat dulu di halaman Contact Lists.
            </p>
          </label>

          <div class="block space-y-1.5">
            <span class="text-sm font-medium text-slate-700">Tipe Pesan</span>
            <div class="flex gap-2">
              <button
                type="button"
                :class="[
                  'flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                  form.type === 'text'
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ]"
                @click="form.type = 'text'"
              >
                <MessageSquare class="h-4 w-4" />
                Teks
              </button>
              <button
                type="button"
                :class="[
                  'flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                  form.type === 'image'
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ]"
                @click="form.type = 'image'"
              >
                <ImageIcon class="h-4 w-4" />
                Gambar
              </button>
            </div>
          </div>

          <!-- Text message -->
          <div v-if="form.type === 'text'" class="block space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-700">Pesan</span>
              <div class="flex items-center gap-1">
                <EmojiPicker @select="insertEmoji" />
                <button
                  type="button"
                  class="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  title="Sisipkan nama penerima"
                  @click="insertName"
                >
                  <span class="font-mono text-primary">{name}</span>
                </button>
              </div>
            </div>
            <textarea
              v-model="form.message"
              rows="4"
              maxlength="4096"
              placeholder="Halo {name}, ada promo menarik untuk Anda..."
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              @focus="onFocus"
            />
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs text-slate-500">
                Gunakan <code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-primary">{name}</code> untuk menampilkan nama penerima.
              </span>
              <span class="text-xs text-slate-400">
                {{ form.message.length }}/4096
              </span>
            </div>
          </div>

          <!-- Image message -->
          <template v-else>
            <label class="space-y-1.5">
              <span class="text-sm font-medium text-slate-700">URL Gambar</span>
              <input
                v-model="form.mediaUrl"
                type="url"
                placeholder="https://example.com/promo-banner.jpg"
                class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span class="text-xs text-slate-400">
                Harus URL publik yang bisa diakses. Maks 15 MB, divalidasi oleh WA Connector.
              </span>
            </label>

            <div class="block space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-slate-700">Caption (opsional)</span>
                <div class="flex items-center gap-1">
                  <EmojiPicker @select="insertEmoji" />
                  <button
                    type="button"
                    class="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Sisipkan nama penerima"
                    @click="insertName"
                  >
                    <span class="font-mono text-primary">{name}</span>
                  </button>
                </div>
              </div>
              <textarea
                v-model="form.caption"
                rows="3"
                maxlength="1024"
                placeholder="Halo {name}, lihat promo kami bulan ini!"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                @focus="onFocus"
              />
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-xs text-slate-500">
                  Gunakan <code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-primary">{name}</code> untuk menampilkan nama penerima.
                </span>
                <span class="text-xs text-slate-400">
                  {{ form.caption.length }}/1024
                </span>
              </div>
            </div>
          </template>

          <label class="space-y-1.5">
            <span class="text-sm font-medium text-slate-700">Delay Antar Penerima (detik)</span>
            <input
              v-model.number="form.delaySeconds"
              type="number"
              min="1"
              max="3600"
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span class="text-xs text-slate-400">Mencegah deteksi spam WhatsApp. Rekomendasi 3-10 detik.</span>
          </label>

          <div class="space-y-1.5">
            <span class="text-sm font-medium text-slate-700">Waktu Kirim</span>
            <div class="flex gap-2">
              <button
                type="button"
                :class="[
                  'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                  form.scheduleMode === 'now'
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ]"
                @click="form.scheduleMode = 'now'"
              >
                Sekarang
              </button>
              <button
                type="button"
                :class="[
                  'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                  form.scheduleMode === 'schedule'
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ]"
                @click="form.scheduleMode = 'schedule'"
              >
                Jadwalkan
              </button>
            </div>
            <input
              v-if="form.scheduleMode === 'schedule'"
              v-model="form.scheduledAt"
              type="datetime-local"
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span v-if="form.scheduleMode === 'schedule'" class="text-xs text-slate-400">
              Broadcast akan dimulai otomatis pada waktu yang dipilih.
            </span>
          </div>
        </div>
        <div class="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4">
          <Button variant="outline" @click="createModal = false">Batal</Button>
          <Button :disabled="saving || !canCreate" @click="createBroadcast">
            <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
            <Megaphone v-else class="h-4 w-4" />
            {{ form.scheduleMode === 'schedule' ? 'Jadwalkan' : 'Mulai Broadcast' }}
          </Button>
        </div>
      </Card>
    </div>
  </div>
</template>
