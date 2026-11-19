<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBroadcastStore } from '../../stores/broadcast'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Alert from '../../components/ui/Alert.vue'
import {
  Loader2,
  Plus,
  Contact as ContactIcon,
  Trash2,
  Users,
  ChevronRight,
  X,
} from 'lucide-vue-next'

const store = useBroadcastStore()
const router = useRouter()

const error = ref('')
const saving = ref(false)
const createModal = ref(false)
const deleteModal = ref({ open: false, list: null })
const form = reactive({ name: '' })

onMounted(() => store.fetchContactLists())

async function createList() {
  if (!form.name.trim()) return
  saving.value = true
  error.value = ''
  try {
    const result = await store.createContactList(form.name.trim())
    form.name = ''
    createModal.value = false
    router.push(`/contact-lists/${result.id}`)
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal membuat contact list'
  } finally {
    saving.value = false
  }
}

function openDelete(list) {
  deleteModal.value = { open: true, list }
}

function closeDelete() {
  deleteModal.value = { open: false, list: null }
}

async function confirmDelete() {
  const list = deleteModal.value.list
  if (!list) return
  saving.value = true
  error.value = ''
  try {
    await store.deleteContactList(list.id)
    closeDelete()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal menghapus contact list'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
          Contact Lists
        </h2>
        <p class="mt-1.5 text-sm text-slate-500">
          Kelola daftar kontak untuk broadcast. Tambah manual atau import CSV.
        </p>
      </div>
      <Button @click="createModal = true">
        <Plus class="h-4 w-4" />
        Buat List
      </Button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div v-if="store.loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Memuat...</span>
    </div>

    <Card
      v-else-if="!store.contactLists.length"
      class="flex flex-col items-center p-12 text-center"
    >
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
        <ContactIcon class="h-7 w-7" />
      </div>
      <p class="text-lg font-bold text-slate-900">Belum ada contact list</p>
      <p class="mt-1 text-sm text-slate-500">
        Buat daftar kontak untuk mulai mengirim broadcast.
      </p>
    </Card>

    <div v-else class="space-y-3">
      <Card
        v-for="list in store.contactLists"
        :key="list.id"
        class="group cursor-pointer overflow-hidden p-0 transition-all duration-200 hover:shadow-md"
        @click="router.push(`/contact-lists/${list.id}`)"
      >
        <div class="flex items-center justify-between p-5">
          <div class="flex min-w-0 items-center gap-4">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-primary-50 group-hover:text-primary">
              <ContactIcon class="h-5 w-5" />
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-slate-900">{{ list.name }}</p>
              <div class="mt-1 flex items-center gap-2">
                <Badge variant="secondary">
                  <Users class="mr-1 h-3 w-3" />
                  {{ list.contactCount }} kontak
                </Badge>
              </div>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              class="text-slate-400 hover:bg-red-50 hover:text-red-600"
              title="Hapus"
              @click.stop="openDelete(list)"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
            <ChevronRight class="h-5 w-5 text-slate-300" />
          </div>
        </div>
      </Card>
    </div>

    <!-- Create modal -->
    <div
      v-if="createModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="createModal = false"
    >
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-0 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 class="font-semibold text-slate-900">Buat Contact List</h3>
          <Button variant="ghost" size="icon" @click="createModal = false">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="p-5">
          <label class="space-y-1.5">
            <span class="text-sm font-medium text-slate-700">Nama List</span>
            <input
              v-model="form.name"
              type="text"
              placeholder="Pelanggan Jakarta"
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              @keyup.enter="createList"
            />
          </label>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <Button variant="outline" @click="createModal = false">Batal</Button>
          <Button :disabled="saving || !form.name.trim()" @click="createList">
            <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
            Buat
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
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-0 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 class="font-semibold text-slate-900">Hapus Contact List</h3>
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
              <p class="font-medium text-slate-900">Hapus list ini beserta semua kontak?</p>
              <p class="mt-2 text-sm text-slate-500">{{ deleteModal.list?.name }}</p>
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
