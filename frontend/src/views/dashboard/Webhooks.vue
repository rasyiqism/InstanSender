<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWebhookStore } from '../../stores/webhook'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Alert from '../../components/ui/Alert.vue'
import Modal from '../../components/ui/Modal.vue'
import {
  Check,
  Globe2,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Webhook,
  ShieldCheck,
} from 'lucide-vue-next'

const store = useWebhookStore()
const router = useRouter()
const saving = ref(false)
const error = ref('')
const copied = ref('')
const deleteModal = ref({ open: false, webhook: null })

const events = [
  { value: 'message.incoming', label: 'Incoming Message', desc: 'New message received' },
  { value: 'message.status', label: 'Message Status', desc: 'Delivery & read updates' },
  { value: 'group.members', label: 'Group Members', desc: 'Member join/leave events' },
]

const eventLabel = (value) =>
  events.find((e) => e.value === value)?.label ?? value

onMounted(() => store.fetch())

const activeCount = computed(
  () => store.webhooks.filter((w) => w.active).length,
)

function openDelete(webhook) {
  deleteModal.value = { open: true, webhook }
}

function closeDelete() {
  deleteModal.value = { open: false, webhook: null }
}

async function deleteWebhook() {
  const webhook = deleteModal.value.webhook
  if (!webhook) return
  saving.value = true
  error.value = ''
  try {
    await store.remove(webhook.id)
    closeDelete()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Failed to delete webhook'
  } finally {
    saving.value = false
  }
}

async function copy(text) {
  await navigator.clipboard.writeText(text)
  copied.value = text
  setTimeout(() => (copied.value = ''), 2000)
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
          Webhooks
        </h2>
        <p class="mt-1.5 text-sm text-slate-500">
          Send account events to external applications in real time.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" @click="store.fetch">
          <Loader2 v-if="store.loading" class="h-4 w-4 animate-spin" />
          <Webhook v-else class="h-4 w-4" />
          Refresh
        </Button>
        <Button @click="router.push({ name: 'webhookAdd' })">
          <Plus class="h-4 w-4" />
          Add Webhook
        </Button>
      </div>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <!-- Loading -->
    <div v-if="store.loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Loading webhooks...</span>
    </div>

    <!-- Empty state -->
    <Card v-else-if="!store.webhooks.length" class="flex flex-col items-center p-12 text-center">
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
        <Webhook class="h-7 w-7" />
      </div>
      <p class="text-lg font-bold text-slate-900">No webhooks yet</p>
      <p class="mt-1 text-sm text-slate-500">
        Add an endpoint URL above to start receiving account events.
      </p>
    </Card>

    <!-- Webhook list -->
    <template v-else>
      <!-- Summary + hint -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <Badge variant="success">{{ activeCount }} Active</Badge>
          <Badge variant="secondary">{{ store.webhooks.length }} Total</Badge>
        </div>
        <p class="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck class="h-3.5 w-3.5" />
          Verify payloads with the signing secret header.
        </p>
      </div>

      <div class="space-y-3">
        <Card
          v-for="webhook in store.webhooks"
          :key="webhook.id"
          class="group p-4 transition-all duration-200 hover:shadow-md sm:p-5"
        >
          <!-- Top row: badges + actions -->
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant="success" v-if="webhook.active">Active</Badge>
              <Badge variant="secondary">{{ eventLabel(webhook.eventType) }}</Badge>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <Button variant="outline" size="sm" class="h-9 gap-1.5" @click="copy(webhook.url)">
                <Check v-if="copied === webhook.url" class="h-3.5 w-3.5 text-primary" />
                <Link2 v-else class="h-3.5 w-3.5" />
                {{ copied === webhook.url ? 'Copied' : 'Copy URL' }}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-9 w-9 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="Delete webhook"
                @click="openDelete(webhook)"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </div>

          <!-- URL -->
          <div class="mt-3 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <Globe2 class="h-4 w-4 shrink-0 text-slate-400" />
            <code class="min-w-0 flex-1 truncate font-mono text-sm text-slate-700">
              {{ webhook.url }}
            </code>
          </div>

          <!-- Meta -->
          <div class="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>ID {{ webhook.id.slice(0, 8) }}…</span>
            <span v-if="webhook.createdAt">Added {{ formatDate(webhook.createdAt) }}</span>
          </div>
        </Card>
      </div>
    </template>

    <!-- Delete modal -->
    <Modal
      :open="deleteModal.open"
      title="Delete Webhook"
      variant="destructive"
      :icon="Trash2"
      @close="closeDelete"
    >
      <p class="font-medium text-slate-900">Delete this webhook?</p>
      <p class="mt-2 text-sm text-slate-500">
        The endpoint will stop receiving events immediately. This can't be undone.
      </p>
      <p class="mt-3 break-all font-mono text-xs text-slate-500">
        {{ deleteModal.webhook?.url }}
      </p>
      <template #footer>
        <Button variant="outline" @click="closeDelete">Cancel</Button>
        <Button variant="destructive" :disabled="saving" @click="deleteWebhook">
          <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
          <Trash2 v-else class="h-4 w-4" />
          Delete
        </Button>
      </template>
    </Modal>
  </div>
</template>
