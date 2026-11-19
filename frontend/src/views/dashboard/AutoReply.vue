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
import EmojiPicker from '../../components/ui/EmojiPicker.vue'
import {
  Loader2,
  Plus,
  Reply,
  Smartphone,
  Trash2,
  Pencil,
  X,
  MessageSquareReply,
} from 'lucide-vue-next'

const devices = useDeviceStore()
const store = useAutoReplyStore()
const router = useRouter()
const { onFocus, insertAtCursor } = useTextareaInsert()

const selectedId = ref('')
const error = ref('')
const saving = ref(false)
const editModal = ref({ open: false, rule: null })
const deleteModal = ref({ open: false, rule: null })

const editForm = reactive({
  keyword: '',
  matchMode: 'contains',
  reply: '',
  active: true,
})

const matchModes = [
  { value: 'contains', label: 'Contains' },
  { value: 'exact', label: 'Exact' },
]

const current = computed(() => store.settings[selectedId.value])
const rules = computed(() => current.value?.rules ?? [])
const enabled = computed(() => current.value?.enabled ?? false)

onMounted(async () => {
  await devices.fetch()
  if (devices.devices.length && !selectedId.value) {
    selectedId.value = devices.devices[0].id
  }
})

watch(selectedId, async (id) => {
  if (!id) return
  error.value = ''
  if (!store.settings[id]) await loadDevice(id)
})

async function loadDevice(id) {
  try {
    await store.fetch(id)
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal memuat aturan'
  }
}

async function toggleEnabled(val) {
  saving.value = true
  error.value = ''
  try {
    await store.setEnabled(selectedId.value, val)
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal mengubah status'
  } finally {
    saving.value = false
  }
}

function openEdit(rule) {
  editForm.keyword = rule.keyword
  editForm.matchMode = rule.matchMode
  editForm.reply = rule.reply
  editForm.active = rule.active
  editModal.value = { open: true, rule }
}

function closeEdit() {
  editModal.value = { open: false, rule: null }
}

function insertEmoji(emoji) {
  insertAtCursor(() => editForm.reply, (v) => (editForm.reply = v), emoji)
}

function insertName() {
  insertAtCursor(() => editForm.reply, (v) => (editForm.reply = v), '{name}')
}

async function saveEdit() {
  const rule = editModal.value.rule
  if (!rule) return
  saving.value = true
  error.value = ''
  try {
    await store.updateRule(selectedId.value, rule.id, {
      keyword: editForm.keyword.trim(),
      matchMode: editForm.matchMode,
      reply: editForm.reply.trim(),
      active: editForm.active,
    })
    closeEdit()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal menyimpan aturan'
  } finally {
    saving.value = false
  }
}

function openDelete(rule) {
  deleteModal.value = { open: true, rule }
}

function closeDelete() {
  deleteModal.value = { open: false, rule: null }
}

async function confirmDelete() {
  const rule = deleteModal.value.rule
  if (!rule) return
  saving.value = true
  error.value = ''
  try {
    await store.deleteRule(selectedId.value, rule.id)
    closeDelete()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal menghapus aturan'
  } finally {
    saving.value = false
  }
}

async function toggleRuleActive(rule) {
  try {
    await store.updateRule(selectedId.value, rule.id, { active: !rule.active })
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal mengubah aturan'
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
          Auto Reply
        </h2>
        <p class="mt-1.5 text-sm text-slate-500">
          Balas pesan WhatsApp masuk otomatis berdasarkan kata kunci per device.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" @click="async () => { await devices.fetch(); if (selectedId) await loadDevice(selectedId) }">
          <Loader2 v-if="devices.loading || store.loading" class="h-4 w-4 animate-spin" />
          <Smartphone v-else class="h-4 w-4" />
          Refresh
        </Button>
        <Button @click="router.push({ name: 'autoReplyAdd' })">
          <Plus class="h-4 w-4" />
          Tambah Aturan
        </Button>
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
    </Card>

    <template v-else>

      <!-- Rules list -->
      <div v-if="selectedId && store.loading" class="flex items-center justify-center py-12">
        <Loader2 class="h-5 w-5 animate-spin text-primary" />
        <span class="ml-2 text-sm text-slate-500">Memuat aturan...</span>
      </div>

      <Card
        v-else-if="selectedId && !rules.length"
        class="flex flex-col items-center p-12 text-center"
      >
        <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
          <MessageSquareReply class="h-7 w-7" />
        </div>
        <p class="text-lg font-bold text-slate-900">Belum ada aturan</p>
        <p class="mt-1 text-sm text-slate-500">
          Tambahkan aturan kata kunci agar pesan masuk dibalas otomatis.
        </p>
      </Card>

      <div v-else-if="selectedId" class="space-y-3">
        <Card
          v-for="rule in rules"
          :key="rule.id"
          class="group overflow-hidden p-0 transition-all duration-200 hover:shadow-md"
        >
          <div class="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 flex items-start gap-4">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors duration-200 group-hover:bg-primary-50 group-hover:text-primary"
              >
                <MessageSquareReply class="h-5 w-5" />
              </div>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{{ rule.matchMode }}</Badge>
                  <Badge :variant="rule.active ? 'success' : 'default'">
                    {{ rule.active ? 'Aktif' : 'Nonaktif' }}
                  </Badge>
                </div>
                <p class="mt-2 text-sm font-semibold text-slate-900">
                  Kata kunci: <span class="font-mono text-primary">{{ rule.keyword }}</span>
                </p>
                <p class="mt-1 break-words text-sm text-slate-600">{{ rule.reply }}</p>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" @click="toggleRuleActive(rule)">
                {{ rule.active ? 'Nonaktifkan' : 'Aktifkan' }}
              </Button>
              <Button variant="ghost" size="icon" title="Edit" @click="openEdit(rule)">
                <Pencil class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="Hapus"
                @click="openDelete(rule)"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </template>

    <!-- Edit modal -->
    <div
      v-if="editModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="closeEdit"
    >
      <Card class="w-full max-w-md p-0 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 class="font-semibold text-slate-900">Edit Aturan</h3>
          <Button variant="ghost" size="icon" @click="closeEdit">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="space-y-4 p-5">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="space-y-1.5">
              <span class="text-sm font-medium text-slate-700">Kata Kunci</span>
              <input
                v-model="editForm.keyword"
                type="text"
                class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label class="space-y-1.5">
              <span class="text-sm font-medium text-slate-700">Cocok</span>
              <select
                v-model="editForm.matchMode"
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
              v-model="editForm.reply"
              rows="3"
              maxlength="4096"
              placeholder="Halo {name}! Terima kasih telah menghubungi kami."
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              @focus="onFocus"
            />
            <span class="text-xs text-slate-500">
              Gunakan <code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-primary">{name}</code> untuk menampilkan nama pengirim.
            </span>
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input
              v-model="editForm.active"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
            />
            Aktif
          </label>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <Button variant="outline" @click="closeEdit">Batal</Button>
          <Button :disabled="saving" @click="saveEdit">
            <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
            Simpan
          </Button>
        </div>
      </Card>
    </div>

    <!-- Delete modal -->
    <div
      v-if="deleteModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="closeDelete"
    >
      <Card class="w-full max-w-md p-0 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 class="font-semibold text-slate-900">Hapus Aturan</h3>
          <Button variant="ghost" size="icon" @click="closeDelete">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="p-5">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 class="h-5 w-5" />
            </div>
            <div class="min-w-0">
              <p class="font-medium text-slate-900">Hapus aturan ini?</p>
              <p class="mt-2 break-words text-sm text-slate-500">
                Kata kunci: <span class="font-mono">{{ deleteModal.rule?.keyword }}</span>
              </p>
            </div>
          </div>
          <div class="mt-5 flex justify-end gap-2">
            <Button variant="outline" @click="closeDelete">Batal</Button>
            <Button variant="destructive" :disabled="saving" @click="confirmDelete">
              <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
              <Trash2 v-else class="h-4 w-4" />
              Hapus
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
