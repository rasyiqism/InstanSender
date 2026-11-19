<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWebhookStore } from '../../stores/webhook'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Alert from '../../components/ui/Alert.vue'
import Modal from '../../components/ui/Modal.vue'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Globe2,
  Loader2,
  Plus,
  Webhook,
} from 'lucide-vue-next'

const router = useRouter()
const store = useWebhookStore()

const saving = ref(false)
const error = ref('')
const copied = ref('')
const successModal = ref({ open: false, secret: '', url: '' })

const form = reactive({
  url: '',
  eventType: 'message.incoming',
})

const events = [
  { value: 'message.incoming', label: 'Incoming Message', desc: 'Triggered when a new message is received.' },
  { value: 'message.status', label: 'Message Status', desc: 'Delivery, sent, and read receipts.' },
  { value: 'group.members', label: 'Group Members', desc: 'Member join/leave updates.' },
]

const selectedEvent = computed(
  () => events.find((e) => e.value === form.eventType) ?? events[0],
)

const valid = computed(() => form.url.trim().length > 0)

function goBack() {
  router.push({ name: 'webhooks' })
}

async function submit() {
  if (!valid.value) return
  saving.value = true
  error.value = ''
  try {
    const result = await store.create({
      url: form.url.trim(),
      eventType: form.eventType,
    })
    successModal.value = { open: true, secret: result.secret, url: result.url }
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Failed to create webhook'
  } finally {
    saving.value = false
  }
}

async function copy(text) {
  await navigator.clipboard.writeText(text)
  copied.value = text
  setTimeout(() => (copied.value = ''), 2000)
}

function onDone() {
  successModal.value.open = false
  router.push({ name: 'webhooks' })
}

function addAnother() {
  successModal.value.open = false
  form.url = ''
  form.eventType = 'message.incoming'
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
          Tambah Webhook
        </h2>
        <p class="mt-1.5 text-sm text-slate-500">
          Daftarkan endpoint untuk menerima event akun secara real time.
        </p>
      </div>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <!-- Form -->
    <Card class="overflow-hidden p-0">
      <div class="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
          <Webhook class="h-4 w-4" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-slate-900">Detail Webhook</h3>
          <p class="text-xs text-slate-500">Isi URL endpoint dan pilih event yang ingin diterima.</p>
        </div>
      </div>

      <form class="space-y-5 p-5" @submit.prevent="submit">
        <!-- Endpoint URL -->
        <label class="block space-y-1.5">
          <span class="text-sm font-medium text-slate-700">Endpoint URL</span>
          <div class="relative">
            <Globe2 class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              v-model="form.url"
              type="url"
              required
              placeholder="https://example.com/webhooks/notifications"
              class="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 py-2 text-sm text-slate-900 ring-offset-white transition-all duration-200 placeholder:text-slate-400 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        </label>

        <!-- Event picker -->
        <div class="space-y-1.5">
          <span class="text-sm font-medium text-slate-700">Event</span>
          <div class="grid gap-2 sm:grid-cols-3">
            <button
              v-for="event in events"
              :key="event.value"
              type="button"
              class="flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-all duration-200"
              :class="form.eventType === event.value
                ? 'border-primary bg-primary-50 ring-1 ring-primary'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'"
              @click="form.eventType = event.value"
            >
              <span
                class="text-sm font-semibold"
                :class="form.eventType === event.value ? 'text-primary-700' : 'text-slate-900'"
              >
                {{ event.label }}
              </span>
              <span class="mt-0.5 text-xs text-slate-500">{{ event.desc }}</span>
            </button>
          </div>
        </div>

        <!-- Preview -->
        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Pratinjau
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <Badge variant="success">Active</Badge>
            <Badge variant="secondary">{{ selectedEvent.label }}</Badge>
          </div>
          <p class="mt-3 text-sm text-slate-500">
            Event <span class="font-semibold text-slate-700">{{ selectedEvent.label }}</span> akan dikirim ke endpoint di bawah ini.
          </p>
          <div
            v-if="form.url.trim()"
            class="mt-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100"
          >
            <Globe2 class="h-4 w-4 shrink-0 text-slate-400" />
            <code class="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">
              {{ form.url }}
            </code>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" type="button" @click="goBack">Batal</Button>
          <Button type="submit" :disabled="saving || !valid">
            <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
            <Plus v-else class="h-4 w-4" />
            Tambah Webhook
          </Button>
        </div>
      </form>
    </Card>

    <!-- Success modal with signing secret -->
    <Modal
      :open="successModal.open"
      title="Webhook Dibuat"
      variant="success"
      :icon="CheckCircle2"
      @close="onDone"
    >
      <p class="text-sm leading-relaxed text-slate-500">
        Simpan <span class="font-medium text-slate-700">signing secret</span> berikut — hanya ditampilkan sekali. Pakai untuk memverifikasi payload yang diterima endpoint.
      </p>
      <div class="mt-3 rounded-xl border border-primary-200 bg-white px-4 py-3">
        <code class="block break-all font-mono text-sm text-slate-700">
          {{ successModal.secret }}
        </code>
      </div>
      <template #footer>
        <Button variant="outline" @click="addAnother">Tambah Lagi</Button>
        <Button variant="secondary" @click="copy(successModal.secret)">
          <Check v-if="copied === successModal.secret" class="h-4 w-4 text-primary" />
          <Copy v-else class="h-4 w-4" />
          {{ copied === successModal.secret ? 'Tersalin' : 'Copy Secret' }}
        </Button>
        <Button @click="onDone">
          <ArrowLeft class="h-4 w-4 rotate-180" />
          Lihat Daftar
        </Button>
      </template>
    </Modal>
  </div>
</template>
