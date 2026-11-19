<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBroadcastStore } from '../../stores/broadcast'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Alert from '../../components/ui/Alert.vue'
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  ArrowLeft,
  X,
  Phone,
  User as UserIcon,
  CheckCircle2,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const store = useBroadcastStore()

const listId = route.params.id
const list = ref(null)
const error = ref('')
const saving = ref(false)
const addModal = ref(false)
const importModal = ref(false)
const deleteModal = ref({ open: false, contact: null })
const importResult = ref(null)

const form = reactive({ phoneNumber: '', name: '' })
const fileInput = ref(null)

onMounted(async () => {
  await loadList()
})

async function loadList() {
  error.value = ''
  try {
    list.value = await store.getContactList(listId)
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal memuat contact list'
  }
}

function openAdd() {
  form.phoneNumber = ''
  form.name = ''
  addModal.value = true
}

async function addContact() {
  if (!form.phoneNumber.trim()) return
  saving.value = true
  error.value = ''
  try {
    await store.addContact(listId, form.phoneNumber.trim(), form.name.trim() || undefined)
    addModal.value = false
    await loadList()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal menambah kontak'
  } finally {
    saving.value = false
  }
}

function openImport() {
  importResult.value = null
  importModal.value = true
}

async function handleImport() {
  const file = fileInput.value?.files?.[0]
  if (!file) return
  saving.value = true
  error.value = ''
  try {
    const result = await store.importCsv(listId, file)
    importResult.value = result
    await loadList()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal import CSV'
  } finally {
    saving.value = false
  }
}

function openDelete(contact) {
  deleteModal.value = { open: true, contact }
}

function closeDelete() {
  deleteModal.value = { open: false, contact: null }
}

async function confirmDelete() {
  const contact = deleteModal.value.contact
  if (!contact) return
  saving.value = true
  error.value = ''
  try {
    await store.deleteContact(listId, contact.id)
    closeDelete()
    await loadList()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal menghapus kontak'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" @click="router.push('/contact-lists')">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-3xl font-extrabold tracking-tight text-slate-900">
          {{ list?.name ?? 'Contact List' }}
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          {{ list?.contacts?.length ?? 0 }} kontak
        </p>
      </div>
      <Button variant="outline" @click="openImport">
        <Upload class="h-4 w-4" />
        Import CSV
      </Button>
      <Button @click="openAdd">
        <Plus class="h-4 w-4" />
        Tambah Kontak
      </Button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div v-if="!list" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Memuat...</span>
    </div>

    <Card
      v-else-if="!list.contacts?.length"
      class="flex flex-col items-center p-12 text-center"
    >
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
        <Phone class="h-7 w-7" />
      </div>
      <p class="text-lg font-bold text-slate-900">Belum ada kontak</p>
      <p class="mt-1 text-sm text-slate-500">
        Tambah kontak manual atau import dari file CSV.
      </p>
    </Card>

    <Card v-else class="overflow-hidden p-0">
      <table class="w-full text-sm">
        <thead class="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-5 py-3">Nama</th>
            <th class="px-5 py-3">Nomor WhatsApp</th>
            <th class="px-5 py-3 w-16"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-for="contact in list.contacts" :key="contact.id" class="transition-colors hover:bg-slate-50">
            <td class="px-5 py-3">
              <div class="flex items-center gap-2">
                <UserIcon class="h-4 w-4 text-slate-400" />
                <span class="text-slate-900">{{ contact.name || '-' }}</span>
              </div>
            </td>
            <td class="px-5 py-3">
              <span class="font-mono text-slate-700">{{ contact.phoneNumber }}</span>
            </td>
            <td class="px-5 py-3 text-right">
              <Button
                variant="ghost"
                size="icon"
                class="text-slate-400 hover:bg-red-50 hover:text-red-600"
                @click="openDelete(contact)"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </Card>

    <!-- Add contact modal -->
    <div
      v-if="addModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="addModal = false"
    >
      <Card class="w-full max-w-md p-0 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 class="font-semibold text-slate-900">Tambah Kontak</h3>
          <Button variant="ghost" size="icon" @click="addModal = false">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="space-y-4 p-5">
          <label class="space-y-1.5">
            <span class="text-sm font-medium text-slate-700">Nomor WhatsApp</span>
            <input
              v-model="form.phoneNumber"
              type="text"
              placeholder="628123456789"
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label class="space-y-1.5">
            <span class="text-sm font-medium text-slate-700">Nama (opsional)</span>
            <input
              v-model="form.name"
              type="text"
              placeholder="Budi"
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <Button variant="outline" @click="addModal = false">Batal</Button>
          <Button :disabled="saving || !form.phoneNumber.trim()" @click="addContact">
            <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
            Tambah
          </Button>
        </div>
      </Card>
    </div>

    <!-- Import CSV modal -->
    <div
      v-if="importModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="importModal = false"
    >
      <Card class="w-full max-w-md p-0 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 class="font-semibold text-slate-900">Import CSV</h3>
          <Button variant="ghost" size="icon" @click="importModal = false">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="p-5">
          <p class="mb-3 text-sm text-slate-500">
            Format: kolom <code class="rounded bg-slate-100 px-1 py-0.5 text-xs">name,phone</code> atau satu kolom nomor. Maks 2MB.
          </p>
          <input
            ref="fileInput"
            type="file"
            accept=".csv,text/csv"
            class="block w-full text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary-100"
          />
          <Alert v-if="importResult" variant="success" class="mt-4">
            <CheckCircle2 class="h-4 w-4" />
            {{ importResult.imported }} terimport, {{ importResult.skipped }} dilewati dari {{ importResult.total }} baris.
          </Alert>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <Button variant="outline" @click="importModal = false">Tutup</Button>
          <Button :disabled="saving" @click="handleImport">
            <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
            <Upload v-else class="h-4 w-4" />
            Import
          </Button>
        </div>
      </Card>
    </div>

    <!-- Delete contact modal -->
    <div
      v-if="deleteModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="closeDelete"
    >
      <Card class="w-full max-w-md p-0 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 class="font-semibold text-slate-900">Hapus Kontak</h3>
          <Button variant="ghost" size="icon" @click="closeDelete">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="p-5">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 class="h-5 w-5" />
            </div>
            <div>
              <p class="font-medium text-slate-900">Hapus kontak ini?</p>
              <p class="mt-2 font-mono text-sm text-slate-500">{{ deleteModal.contact?.phoneNumber }}</p>
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
