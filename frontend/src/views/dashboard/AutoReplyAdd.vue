<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDeviceStore } from '../../stores/device'
import { useAutoReplyStore } from '../../stores/autoReply'
import { useTextareaInsert } from '../../composables/useTextareaInsert'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Alert from '../../components/ui/Alert.vue'
import Modal from '../../components/ui/Modal.vue'
import EmojiPicker from '../../components/ui/EmojiPicker.vue'
import {
  Loader2,
  ArrowLeft,
  Reply,
  Smartphone,
  MessageSquareReply,
  CheckCircle2,
  XCircle,
} from 'lucide-vue-next'

const router = useRouter()
const devices = useDeviceStore()
const store = useAutoReplyStore()
const { onFocus, insertAtCursor } = useTextareaInsert()

const selectedId = ref('')
const error = ref('')
const saving = ref(false)
const successModal = ref({ open: false })

const form = reactive({
  keyword: '',
  matchMode: 'contains',
  reply: '',
  active: true,
})

const matchModes = [
  { value: 'contains', label: 'Contains' },
  { value: 'exact', label: 'Exact' },
]

const selectedDevice = computed(() =>
  (devices.devices || []).find((d) => d && d.id === selectedId.value),
)

const valid = computed(
  () => form.keyword.trim().length > 0 && form.reply.trim().length > 0,
)

// Render the reply preview, substituting {name} with a sample sender name.
const replyPreview = computed(() =>
  form.reply.trim()
    ? form.reply.replace(/\{name\}/gi, 'Andi')
    : '',
)

function insertEmoji(emoji) {
  insertAtCursor(() => form.reply, (v) => (form.reply = v), emoji)
}

function insertName() {
  insertAtCursor(() => form.reply, (v) => (form.reply = v), '{name}')
}

onMounted(async () => {
  await devices.fetch()
  const validDevices = (devices.devices || []).filter((d) => d && d.id)
  if (validDevices.length && !selectedId.value) {
    selectedId.value = validDevices[0].id
  }
})

watch(selectedId, (id) => {
  if (id && !error.value.startsWith('Gagal memuat')) return
  error.value = ''
})

function goBack() {
  router.push({ name: 'autoReply' })
}

async function submit() {
  if (!selectedId.value) {
    error.value = 'Pilih device terlebih dahulu'
    return
  }
  if (!valid.value) return
  saving.value = true
  error.value = ''
  try {
    await store.createRule(selectedId.value, {
      keyword: form.keyword.trim(),
      matchMode: form.matchMode,
      reply: form.reply.trim(),
      active: form.active,
    })
    successModal.value = { open: true }
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal menambah aturan'
  } finally {
    saving.value = false
  }
}

function onSaved() {
  successModal.value.open = false
  router.push({ name: 'autoReply' })
}

function addAnother() {
  successModal.value.open = false
  form.keyword = ''
  form.matchMode = 'contains'
  form.reply = ''
  form.active = true
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-start gap-4">
      <Button variant="ghost" size="icon" class="shrink-0" title="Kembali" @click="goBack">
        <ArrowLeft class="h-4 w-4" />
      </Button>
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
          Tambah Auto Reply
        </h2>
        <p class="mt-1.5 text-sm text-slate-500">
          Buat aturan balasan otomatis berdasarkan kata kunci untuk device WhatsApp.
        </p>
      </div>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <!-- Empty: no devices -->
    <Card
      v-if="!devices.loading && !devices.devices.length"
      class="flex flex-col items-center p-12 text-center"
    >
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
        <Smartphone class="h-7 w-7" />
      </div>
      <p class="text-lg font-bold text-slate-900">Belum ada device</p>
      <p class="mt-1 text-sm text-slate-500">
        Hubungkan perangkat WhatsApp terlebih dahulu di halaman Devices.
      </p>
      <Button variant="outline" class="mt-5" @click="goBack">Kembali ke Auto Reply</Button>
    </Card>

    <template v-else>
      <!-- Device selector -->
      <Card class="p-5">
        <label class="space-y-1.5">
          <span class="text-sm font-medium text-slate-700">Pilih Device</span>
          <select
            v-model="selectedId"
            class="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option v-for="d in (devices.devices || []).filter((d) => d && d.id)" :key="d.id" :value="d.id">
              {{ d.name }}{{ d.phoneNumber ? ` (${d.phoneNumber})` : '' }}
            </option>
          </select>
        </label>
      </Card>

      <!-- Rule form -->
      <Card class="p-5">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <MessageSquareReply class="h-5 w-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900">Detail Aturan</h3>
            <p class="text-xs text-slate-500">Isi kata kunci dan balasan yang akan dikirim otomatis.</p>
          </div>
        </div>

        <form class="space-y-4" @submit.prevent="submit">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="space-y-1.5">
              <span class="text-sm font-medium text-slate-700">Kata Kunci</span>
              <input
                v-model="form.keyword"
                type="text"
                required
                placeholder="info"
                class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label class="space-y-1.5">
              <span class="text-sm font-medium text-slate-700">Cocok</span>
              <select
                v-model="form.matchMode"
                class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option v-for="m in matchModes" :key="m.value" :value="m.value">
                  {{ m.label }}
                </option>
              </select>
            </label>
          </div>

          <div class="block space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-700">Balasan</span>
              <div class="flex items-center gap-1">
                <EmojiPicker @select="insertEmoji" />
                <button
                  type="button"
                  class="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  title="Sisipkan nama pengirim"
                  @click="insertName"
                >
                  <span class="font-mono text-primary">{name}</span>
                </button>
              </div>
            </div>
            <textarea
              v-model="form.reply"
              required
              rows="4"
              maxlength="4096"
              placeholder="Halo {name}! Terima kasih telah menghubungi kami."
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              @focus="onFocus"
            />
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs text-slate-500">
                Gunakan <code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-primary">{name}</code> untuk menampilkan nama pengirim.
              </span>
              <span class="text-xs text-slate-400">
                {{ form.reply.length }}/4096
              </span>
            </div>
          </div>

          <!-- Preview -->
          <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Pratinjau
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{{ form.matchMode }}</Badge>
              <Badge :variant="form.active ? 'success' : 'default'">
                {{ form.active ? 'Aktif' : 'Nonaktif' }}
              </Badge>
            </div>
            <p class="mt-3 text-sm text-slate-500">
              Ketika pesan masuk {{ form.matchMode === 'exact' ? 'sama persis dengan' : 'mengandung' }}
              <span class="font-mono font-semibold text-primary">
                {{ form.keyword.trim() || '—' }}
              </span>
            </p>
            <div
              v-if="replyPreview"
              class="mt-3 max-w-md rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm ring-1 ring-slate-100"
            >
              {{ replyPreview }}
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3">
            <label class="flex items-center gap-2 text-sm text-slate-700">
              <input
                v-model="form.active"
                type="checkbox"
                class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
              />
              Aktifkan aturan
            </label>
            <div class="flex items-center gap-2">
              <Button variant="outline" type="button" @click="goBack">Batal</Button>
              <Button type="submit" :disabled="saving || !valid">
                <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
                <Reply v-else class="h-4 w-4" />
                Simpan Aturan
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </template>

    <!-- Success modal -->
    <Modal
      :open="successModal.open"
      title="Aturan Tersimpan"
      variant="success"
      :icon="CheckCircle2"
      close-text="Lihat Daftar"
      @close="onSaved"
    >
      <p class="text-sm leading-relaxed text-slate-500">
        Aturan auto reply untuk
        <span class="font-medium text-slate-700">{{ selectedDevice?.name ?? 'device' }}</span>
        berhasil ditambahkan.
      </p>
      <template #footer>
        <Button variant="outline" @click="addAnother">Tambah Lagi</Button>
        <Button @click="onSaved">
          <ArrowLeft class="h-4 w-4 rotate-180" />
          Lihat Daftar
        </Button>
      </template>
    </Modal>
  </div>
</template>
