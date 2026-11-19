<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useAgencyStore } from '../../stores/agency'
import { useBillingStore } from '../../stores/billing'
import Card from '../../components/ui/Card.vue'
import Button from '../../components/ui/Button.vue'
import Badge from '../../components/ui/Badge.vue'
import Alert from '../../components/ui/Alert.vue'
import { Building2, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-vue-next'

const store = useAgencyStore()
const billing = useBillingStore()

const error = ref('')
const busy = ref(false)
const createModal = ref(false)
const editModal = ref({ open: false, pkg: null })
const deleteModal = ref({ open: false, pkg: null })

const form = reactive({
  name: '',
  deviceQuota: 0,
  activationLimit: 10,
  allowedPackages: ['Basic'],
  durationDays: 365,
  price: '',
  features: '',
})

const editForm = reactive({
  name: '',
  deviceQuota: 0,
  activationLimit: 10,
  allowedPackages: ['Basic'],
  durationDays: 365,
  price: '',
  features: '',
  active: true,
})

onMounted(() => load())

async function load() {
  error.value = ''
  try {
    await Promise.all([
      store.adminFetchAgencyPackages(),
      billing.fetchPackages().catch(() => {}),
    ])
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal memuat'
  }
}

async function create() {
  error.value = ''
  busy.value = true
  try {
    await store.adminCreateAgencyPackage({
      name: form.name,
      deviceQuota: Number(form.deviceQuota),
      activationLimit: Number(form.activationLimit),
      allowedPackages: form.allowedPackages.filter(Boolean),
      durationDays: Number(form.durationDays),
      price: form.price,
      features: form.features ? form.features.split(',').map((f) => f.trim()).filter(Boolean) : undefined,
    })
    form.name = ''
    form.deviceQuota = 0
    form.activationLimit = 10
    form.allowedPackages = ['Basic']
    form.durationDays = 365
    form.price = ''
    form.features = ''
    createModal.value = false
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal membuat package'
  } finally {
    busy.value = false
  }
}

async function confirmDelete() {
  busy.value = true
  error.value = ''
  try {
    await store.adminDeleteAgencyPackage(deleteModal.value.pkg.id)
    deleteModal.value = { open: false, pkg: null }
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal menghapus'
  } finally {
    busy.value = false
  }
}

function openEdit(pkg) {
  editForm.name = pkg.name
  editForm.deviceQuota = pkg.deviceQuota
  editForm.activationLimit = pkg.activationLimit
  editForm.allowedPackages = Array.isArray(pkg.allowedPackages)
    ? [...pkg.allowedPackages]
    : pkg.allowedPackages
      ? String(pkg.allowedPackages).split(',').map((s) => s.trim()).filter(Boolean)
      : []
  editForm.durationDays = pkg.durationDays
  editForm.price = pkg.price
  editForm.features = Array.isArray(pkg.features)
    ? pkg.features.join(', ')
    : (pkg.features || '')
  editForm.active = pkg.active
  editModal.value = { open: true, pkg }
}

async function saveEdit() {
  busy.value = true
  error.value = ''
  try {
    const features = editForm.features
      ? editForm.features.split(',').map((f) => f.trim()).filter(Boolean)
      : undefined
    await store.adminUpdateAgencyPackage(editModal.value.pkg.id, {
      name: editForm.name,
      deviceQuota: Number(editForm.deviceQuota),
      activationLimit: Number(editForm.activationLimit),
      allowedPackages: editForm.allowedPackages.filter(Boolean),
      durationDays: Number(editForm.durationDays),
      price: editForm.price,
      features,
      active: editForm.active,
    })
    editModal.value = { open: false, pkg: null }
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal update package'
  } finally {
    busy.value = false
  }
}

function formatPrice(p) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(p))
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Agency Packages</h2>
        <p class="mt-1 text-sm text-slate-500">Kelola kuota lisensi dan batas aktivasi reseller.</p>
      </div>
      <Button class="gap-1.5" @click="createModal = true">
        <Plus class="h-4 w-4" />
        <span>Create Package</span>
      </Button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div v-if="!store.agencyPackages.length" class="flex items-center justify-center py-16">
      <Loader2 class="h-6 w-6 animate-spin text-slate-700" />
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card
        v-for="pkg in store.agencyPackages"
        :key="pkg.id"
        class="flex flex-col justify-between p-5 transition-all duration-150 hover:border-slate-300 hover:scale-[1.01]"
      >
        <div>
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                <Building2 class="h-5 w-5" />
              </div>
              <div>
                <p class="font-bold text-slate-900 tracking-tight">{{ pkg.name }}</p>
                <Badge :variant="pkg.active ? 'success' : 'secondary'">{{ pkg.active ? 'Active' : 'Inactive' }}</Badge>
              </div>
            </div>
            <div class="flex gap-1">
              <button
                class="text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg p-1.5 transition-colors cursor-pointer"
                title="Edit"
                @click="openEdit(pkg)"
              >
                <Pencil class="h-4 w-4" />
              </button>
              <button
                class="text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg p-1.5 transition-colors cursor-pointer"
                title="Hapus"
                @click="deleteModal = { open: true, pkg }"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          </div>

          <dl class="mt-5 space-y-2 text-xs">
            <div class="flex justify-between py-1 border-b border-slate-100">
              <dt class="text-slate-500">Batas Aktivasi</dt>
              <dd class="font-mono font-bold text-slate-900">{{ pkg.activationLimit ?? 0 }}x</dd>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <dt class="text-slate-500">Allowed Packages</dt>
              <dd class="font-semibold text-slate-800">{{ Array.isArray(pkg.allowedPackages) ? (pkg.allowedPackages.length ? pkg.allowedPackages.join(', ') : 'Semua') : (pkg.allowedPackages || 'Semua') }}</dd>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <dt class="text-slate-500">Durasi</dt>
              <dd class="font-mono text-slate-700">{{ pkg.durationDays }} hari</dd>
            </div>
            <div class="flex justify-between pt-1">
              <dt class="text-slate-500 font-medium">Harga</dt>
              <dd class="font-mono text-sm font-bold text-emerald-600 tracking-wider">{{ formatPrice(pkg.price) }}</dd>
            </div>
          </dl>
        </div>

        <div v-if="Array.isArray(pkg.features) ? pkg.features.length : pkg.features" class="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1">
          <Badge v-for="f in (Array.isArray(pkg.features) ? pkg.features : String(pkg.features).split(',').map((s) => s.trim()).filter(Boolean))" :key="f" variant="secondary">{{ f }}</Badge>
        </div>
      </Card>
    </div>

    <!-- Create modal (with mobile bottom-sheet ergonomics) -->
    <div
      v-if="createModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 max-sm:items-end max-sm:p-0"
      @click.self="createModal = false"
    >
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-0 shadow-xl border-slate-200/90 max-sm:max-h-[85vh] max-sm:rounded-b-none max-sm:rounded-t-3xl">
        <div class="hidden max-sm:flex justify-center pt-2.5 pb-1">
          <span class="h-1.5 w-10 rounded-full bg-slate-300"></span>
        </div>
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 class="font-bold text-slate-900 tracking-tight">Create Agency Package</h3>
          <Button variant="ghost" size="icon" @click="createModal = false"><X class="h-4 w-4" /></Button>
        </div>
        <div class="space-y-4 p-5">
          <label class="block space-y-1.5">
            <span class="text-xs font-semibold text-slate-700">Nama Paket</span>
            <input v-model="form.name" type="text" placeholder="Agency Starter" class="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm focus:bg-white focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="space-y-1.5">
              <span class="text-xs font-semibold text-slate-700">Batas Aktivasi</span>
              <input v-model.number="form.activationLimit" type="number" min="0" class="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm focus:bg-white focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all font-mono" />
            </label>
            <label class="space-y-1.5">
              <span class="text-xs font-semibold text-slate-700">Durasi (hari)</span>
              <input v-model.number="form.durationDays" type="number" min="1" class="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm focus:bg-white focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all font-mono" />
            </label>
          </div>
          <div class="block space-y-1.5">
            <span class="text-xs font-semibold text-slate-700">Allowed Packages</span>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="p in billing.packages"
                :key="p.id"
                class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-50 has-[:checked]:border-slate-900 has-[:checked]:bg-slate-900 has-[:checked]:text-white"
              >
                <input v-model="form.allowedPackages" type="checkbox" :value="p.name" class="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20" />
                {{ p.name }}
              </label>
            </div>
            <span class="text-[11px] text-slate-400">Kosongkan untuk mengizinkan semua jenis paket.</span>
          </div>
          <label class="block space-y-1.5">
            <span class="text-xs font-semibold text-slate-700">Harga (IDR)</span>
            <input v-model="form.price" type="text" placeholder="999000" class="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm focus:bg-white focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all font-mono tracking-wider" />
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-semibold text-slate-700">Fitur (pisahkan dengan koma)</span>
            <input v-model="form.features" type="text" placeholder="White Label, Multi User" class="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm focus:bg-white focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all" />
          </label>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-3.5 bg-slate-50/50">
          <Button variant="outline" @click="createModal = false">Batal</Button>
          <Button :disabled="busy || !form.name || !form.price" @click="create">
            <Loader2 v-if="busy" class="h-4 w-4 animate-spin" />
            <span>Simpan</span>
          </Button>
        </div>
      </Card>
    </div>

    <!-- Edit modal -->
    <div
      v-if="editModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 max-sm:items-end max-sm:p-0"
      @click.self="editModal.open = false"
    >
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-0 shadow-xl border-slate-200/90 max-sm:max-h-[85vh] max-sm:rounded-b-none max-sm:rounded-t-3xl">
        <div class="hidden max-sm:flex justify-center pt-2.5 pb-1">
          <span class="h-1.5 w-10 rounded-full bg-slate-300"></span>
        </div>
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 class="font-bold text-slate-900 tracking-tight">Edit Agency Package</h3>
          <Button variant="ghost" size="icon" @click="editModal.open = false"><X class="h-4 w-4" /></Button>
        </div>
        <div class="space-y-4 p-5">
          <label class="block space-y-1.5">
            <span class="text-xs font-semibold text-slate-700">Nama Paket</span>
            <input v-model="editForm.name" type="text" class="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm focus:bg-white focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="space-y-1.5">
              <span class="text-xs font-semibold text-slate-700">Batas Aktivasi</span>
              <input v-model.number="editForm.activationLimit" type="number" min="0" class="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm focus:bg-white focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all font-mono" />
            </label>
            <label class="space-y-1.5">
              <span class="text-xs font-semibold text-slate-700">Durasi (hari)</span>
              <input v-model.number="editForm.durationDays" type="number" min="1" class="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm focus:bg-white focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all font-mono" />
            </label>
          </div>
          <div class="block space-y-1.5">
            <span class="text-xs font-semibold text-slate-700">Allowed Packages</span>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="p in billing.packages"
                :key="p.id"
                class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-50 has-[:checked]:border-slate-900 has-[:checked]:bg-slate-900 has-[:checked]:text-white"
              >
                <input v-model="editForm.allowedPackages" type="checkbox" :value="p.name" class="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20" />
                {{ p.name }}
              </label>
            </div>
          </div>
          <label class="block space-y-1.5">
            <span class="text-xs font-semibold text-slate-700">Harga (IDR)</span>
            <input v-model="editForm.price" type="text" class="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm focus:bg-white focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all font-mono tracking-wider" />
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-semibold text-slate-700">Fitur</span>
            <input v-model="editForm.features" type="text" class="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm focus:bg-white focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all" />
          </label>
          <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input v-model="editForm.active" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20" />
            <span>Status Aktif</span>
          </label>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-3.5 bg-slate-50/50">
          <Button variant="outline" @click="editModal.open = false">Batal</Button>
          <Button :disabled="busy" @click="saveEdit">
            <Loader2 v-if="busy" class="h-4 w-4 animate-spin" />
            <span>Simpan</span>
          </Button>
        </div>
      </Card>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="deleteModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 max-sm:items-end max-sm:p-0"
      @click.self="deleteModal.open = false"
    >
      <Card class="w-full max-w-sm p-5 shadow-xl border-slate-200/90 max-sm:rounded-b-none max-sm:rounded-t-3xl">
        <h4 class="text-base font-bold text-slate-900">Hapus Paket</h4>
        <p class="mt-1.5 text-xs text-slate-600">
          Yakin ingin menghapus paket <strong class="text-slate-900">"{{ deleteModal.pkg?.name }}"</strong>? Tindakan ini tidak dapat dibatalkan.
        </p>
        <div class="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" @click="deleteModal.open = false">Batal</Button>
          <Button variant="destructive" size="sm" :disabled="busy" @click="confirmDelete">
            <Trash2 class="h-3.5 w-3.5" />
            <span>Hapus</span>
          </Button>
        </div>
      </Card>
    </div>
  </div>
</template>
