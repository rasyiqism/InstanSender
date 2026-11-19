<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAgencyStore } from '../../stores/agency'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Alert from '../../components/ui/Alert.vue'
import { Loader2, Plus, Users, RefreshCw, X } from 'lucide-vue-next'

const router = useRouter()
const store = useAgencyStore()
const error = ref('')
const loading = ref(false)
const renewModal = ref({ open: false, user: null })

onMounted(() => load())

async function load() {
  loading.value = true
  error.value = ''
  try {
    await store.fetchUsers()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal memuat users'
  } finally {
    loading.value = false
  }
}

async function toggleSuspend(user) {
  error.value = ''
  try {
    if (user.suspended) {
      await store.activateUser(user.id)
    } else {
      await store.suspendUser(user.id)
    }
    await load()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal mengubah status user'
  }
}

function openRenew(user) {
  renewModal.value = { open: true, user }
}

async function confirmRenew() {
  error.value = ''
  try {
    await store.renewUser(renewModal.value.user.id)
    renewModal.value = { open: false, user: null }
    await load()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal renew user'
  }
}

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">Agency Users</h2>
        <p class="mt-1.5 text-sm text-slate-500">Kelola user yang dibuat oleh agency Anda.</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="load">
          <RefreshCw class="h-4 w-4" :class="loading ? 'animate-spin' : ''" />
        </Button>
        <Button @click="router.push('/agency/users/create')">
          <Plus class="h-4 w-4" />
          Create User
        </Button>
      </div>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div v-if="loading && !store.users.length" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Memuat...</span>
    </div>

    <Card v-else-if="!store.users.length" class="flex flex-col items-center p-12 text-center">
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
        <Users class="h-7 w-7" />
      </div>
      <p class="text-lg font-bold text-slate-900">Belum ada user</p>
      <p class="mt-1 text-sm text-slate-500">Buat user pertama untuk agency Anda.</p>
      <Button class="mt-4" @click="router.push('/agency/users/create')">
        <Plus class="h-4 w-4" />
        Create User
      </Button>
    </Card>

    <Card v-else class="overflow-hidden p-0">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-5 py-3">User</th>
              <th class="px-5 py-3">Package</th>
              <th class="px-5 py-3">Devices</th>
              <th class="px-5 py-3">Status</th>
              <th class="px-5 py-3">Expired</th>
              <th class="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="u in store.users" :key="u.id" class="transition-colors hover:bg-slate-50">
              <td class="px-5 py-3">
                <p class="font-medium text-slate-900">{{ u.name }}</p>
                <p class="text-xs text-slate-500">{{ u.email }}</p>
              </td>
              <td class="px-5 py-3 text-slate-700">{{ u.package || '-' }}</td>
              <td class="px-5 py-3 text-slate-700">{{ u.deviceCount }} / {{ u.maxDevice }}</td>
              <td class="px-5 py-3">
                <Badge v-if="u.suspended" variant="destructive">Suspended</Badge>
                <Badge v-else-if="u.subscriptionStatus === 'active'" variant="success">Active</Badge>
                <Badge v-else variant="warning">{{ u.subscriptionStatus || 'pending' }}</Badge>
              </td>
              <td class="px-5 py-3 text-slate-500">{{ formatDate(u.subscriptionEnd) }}</td>
              <td class="px-5 py-3">
                <div class="flex justify-end gap-1">
                  <button class="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100" @click="openRenew(u)">Renew</button>
                  <button class="rounded-lg px-2 py-1 text-xs hover:bg-slate-100" :class="u.suspended ? 'text-green-600' : 'text-amber-600'" @click="toggleSuspend(u)">
                    {{ u.suspended ? 'Activate' : 'Suspend' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Renew modal -->
    <div v-if="renewModal.open" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" @click.self="renewModal.open = false">
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-0 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 class="font-semibold text-slate-900">Renew User</h3>
          <Button variant="ghost" size="icon" @click="renewModal.open = false"><X class="h-4 w-4" /></Button>
        </div>
        <div class="p-5">
          <p class="text-sm text-slate-600">Perpanjang subscription untuk <strong>{{ renewModal.user?.name }}</strong>?</p>
          <p class="mt-2 text-xs text-slate-400">Subscription akan diperpanjang sesuai durasi package ({{ renewModal.user?.package }}).</p>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <Button variant="outline" @click="renewModal.open = false">Batal</Button>
          <Button @click="confirmRenew">Konfirmasi Renew</Button>
        </div>
      </Card>
    </div>
  </div>
</template>
