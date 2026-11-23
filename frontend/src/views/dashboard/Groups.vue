<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDeviceStore } from '../../stores/device'
import { useBroadcastStore } from '../../stores/broadcast'
import api from '../../services/api'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Alert from '../../components/ui/Alert.vue'
import {
  Users,
  Smartphone,
  RefreshCw,
  Loader2,
  FolderPlus,
  ArrowRight,
  Shield,
  User,
  X,
  Search,
} from 'lucide-vue-next'

const router = useRouter()
const deviceStore = useDeviceStore()
const broadcastStore = useBroadcastStore()

const selectedDeviceId = ref('')
const groups = ref([])
const loadingGroups = ref(false)
const error = ref('')
const searchQuery = ref('')

// Members modal
const selectedGroup = ref(null)
const members = ref([])
const loadingMembers = ref(false)
const showMembersModal = ref(false)
const savingToContactList = ref(false)
const saveSuccessMessage = ref('')

const connectedDevices = computed(() =>
  (deviceStore.devices || []).filter((d) => d.status === 'connected'),
)

const filteredGroups = computed(() => {
  if (!searchQuery.value.trim()) return groups.value
  const q = searchQuery.value.toLowerCase()
  return groups.value.filter(
    (g) =>
      (g.name || g.subject || '').toLowerCase().includes(q) ||
      (g.jid || '').toLowerCase().includes(q),
  )
})

onMounted(async () => {
  await deviceStore.fetch()
  if (connectedDevices.value.length > 0) {
    selectedDeviceId.value = connectedDevices.value[0].id
    await fetchGroups()
  }
})

async function fetchGroups() {
  if (!selectedDeviceId.value) return
  loadingGroups.value = true
  error.value = ''
  try {
    const { data } = await api.post('/v1/groups', { deviceId: selectedDeviceId.value })
    groups.value = Array.isArray(data) ? data : data.groups || []
  } catch (err) {
    error.value = err.response?.data?.message || err.response?.data?.error || 'Gagal memuat grup WhatsApp'
    groups.value = []
  } finally {
    loadingGroups.value = false
  }
}

async function viewMembers(group) {
  selectedGroup.value = group
  showMembersModal.value = true
  loadingMembers.value = true
  members.value = []
  saveSuccessMessage.value = ''

  try {
    const jid = group.jid || group.id
    const { data } = await api.post('/v1/groups/members', {
      deviceId: selectedDeviceId.value,
      groupJid: jid,
    })
    members.value = Array.isArray(data) ? data : data.members || []
  } catch (err) {
    error.value = err.response?.data?.message || 'Gagal mengambil anggota grup'
  } finally {
    loadingMembers.value = false
  }
}

async function exportMembersToContactList() {
  if (!selectedGroup.value || members.value.length === 0) return
  savingToContactList.value = true
  saveSuccessMessage.value = ''

  try {
    const groupName = selectedGroup.value.name || selectedGroup.value.subject || 'Grup WA'
    const listName = `Grup: ${groupName.slice(0, 25)} (${new Date().toLocaleDateString('id-ID')})`
    
    // Create new contact list
    const newList = await broadcastStore.createContactList(listName)

    // Add members to list
    let count = 0
    for (const m of members.value) {
      const phone = (m.phoneNumber || m.jid || m.id || '').replace(/[^\d+]/g, '')
      if (phone && phone.length >= 6) {
        await broadcastStore.addContact(newList.id, phone, m.name || m.pushName || null)
        count++
      }
    }

    saveSuccessMessage.value = `Berhasil menyimpan ${count} anggota ke Contact List "${listName}"!`
  } catch (err) {
    alert(err.response?.data?.message || 'Gagal menyimpan anggota ke contact list')
  } finally {
    savingToContactList.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Grup WhatsApp</h2>
        <p class="mt-1 text-sm text-slate-500">
          Sinkronisasi daftar grup WhatsApp dari perangkat terhubung dan ekspor anggota ke Contact List.
        </p>
      </div>

      <!-- Device Selector & Refresh -->
      <div class="flex items-center gap-2">
        <select
          v-model="selectedDeviceId"
          class="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none"
          :disabled="loadingGroups || connectedDevices.length === 0"
          @change="fetchGroups"
        >
          <option v-if="connectedDevices.length === 0" value="">Belum ada device terhubung</option>
          <option v-for="d in connectedDevices" :key="d.id" :value="d.id">
            {{ d.name }} ({{ d.phoneNumber || 'Scan QR' }})
          </option>
        </select>

        <Button
          variant="outline"
          size="icon"
          :disabled="loadingGroups || !selectedDeviceId"
          @click="fetchGroups"
        >
          <RefreshCw class="h-4 w-4" :class="loadingGroups ? 'animate-spin' : ''" />
        </Button>
      </div>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <!-- Empty device alert -->
    <div
      v-if="connectedDevices.length === 0"
      class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center"
    >
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
        <Smartphone class="h-6 w-6" />
      </div>
      <h3 class="mt-4 text-base font-bold text-slate-900">Tidak ada perangkat WhatsApp aktif</h3>
      <p class="mt-1 text-sm text-slate-500">
        Hubungkan perangkat WhatsApp Anda terlebih dahulu untuk melihat daftar grup.
      </p>
      <div class="mt-6">
        <router-link to="/devices">
          <Button variant="primary">Ke Halaman Devices</Button>
        </router-link>
      </div>
    </div>

    <!-- Groups Content -->
    <template v-else>
      <div class="flex items-center justify-between gap-4">
        <div class="relative flex-1 max-w-md">
          <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari nama grup atau JID..."
            class="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none"
          />
        </div>
        <p class="text-xs text-slate-500 font-mono">
          Total: {{ filteredGroups.length }} grup
        </p>
      </div>

      <div v-if="loadingGroups" class="flex items-center justify-center py-16">
        <Loader2 class="h-6 w-6 animate-spin text-primary" />
        <span class="ml-2 text-sm text-slate-500">Mengambil daftar grup dari WhatsApp...</span>
      </div>

      <Card v-else-if="filteredGroups.length === 0" class="p-12 text-center">
        <Users class="mx-auto h-12 w-12 text-slate-300" />
        <p class="mt-3 text-base font-bold text-slate-900">Tidak ada grup ditemukan</p>
        <p class="mt-1 text-sm text-slate-500">
          Perangkat ini belum bergabung ke grup WhatsApp atau pencarian tidak cocok.
        </p>
      </Card>

      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="g in filteredGroups"
          :key="g.jid || g.id"
          class="flex flex-col justify-between p-5 transition-all duration-150 hover:border-slate-300"
        >
          <div>
            <div class="flex items-start justify-between gap-2">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Users class="h-5 w-5" />
              </div>
              <Badge variant="secondary" class="font-mono text-[10px]">
                {{ g.participants?.length || g.participantCount || 'Grup' }}
              </Badge>
            </div>
            <h4 class="mt-3 font-bold text-slate-900 line-clamp-1">
              {{ g.name || g.subject || 'Tanpa Nama' }}
            </h4>
            <p class="mt-1 font-mono text-xs text-slate-400 truncate">
              {{ g.jid || g.id }}
            </p>
          </div>

          <div class="mt-5 border-t border-slate-100 pt-3">
            <Button
              variant="outline"
              size="sm"
              class="w-full justify-between"
              @click="viewMembers(g)"
            >
              <span>Lihat Anggota</span>
              <ArrowRight class="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      </div>
    </template>

    <!-- Modal Anggota Grup -->
    <div
      v-if="showMembersModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
    >
      <div class="max-h-[85vh] w-full max-w-xl flex flex-col rounded-2xl bg-white shadow-xl overflow-hidden border border-slate-100">
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 class="font-bold text-slate-900">
              Anggota: {{ selectedGroup?.name || selectedGroup?.subject || 'Grup' }}
            </h3>
            <p class="text-xs text-slate-500 font-mono">
              {{ members.length }} kontak teridentifikasi
            </p>
          </div>
          <button
            class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            @click="showMembersModal = false"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <div v-if="saveSuccessMessage" class="mx-6 mt-4">
          <Alert variant="success">{{ saveSuccessMessage }}</Alert>
        </div>

        <!-- Modal Body (Member list) -->
        <div class="flex-1 overflow-y-auto px-6 py-4">
          <div v-if="loadingMembers" class="flex items-center justify-center py-12">
            <Loader2 class="h-5 w-5 animate-spin text-primary" />
            <span class="ml-2 text-sm text-slate-500">Memuat anggota grup...</span>
          </div>

          <div v-else-if="members.length === 0" class="py-8 text-center text-sm text-slate-500">
            Tidak ada detail anggota yang dapat dibaca.
          </div>

          <div v-else class="divide-y divide-slate-100">
            <div
              v-for="m in members"
              :key="m.jid || m.id || m.phoneNumber"
              class="flex items-center justify-between py-2.5 text-sm"
            >
              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <User class="h-4 w-4" />
                </div>
                <div>
                  <p class="font-medium text-slate-900">
                    {{ m.name || m.pushName || (m.phoneNumber ? `+${m.phoneNumber}` : m.jid || 'Anggota') }}
                  </p>
                  <p v-if="m.phoneNumber" class="text-xs font-mono text-slate-400">
                    +{{ m.phoneNumber }}
                  </p>
                </div>
              </div>
              <Badge v-if="m.isAdmin || m.isSuperAdmin" variant="primary" class="text-[10px]">
                <Shield class="mr-1 h-3 w-3" /> Admin
              </Badge>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          <Button variant="ghost" @click="showMembersModal = false">Tutup</Button>
          <Button
            variant="primary"
            class="gap-1.5"
            :disabled="loadingMembers || members.length === 0 || savingToContactList"
            @click="exportMembersToContactList"
          >
            <Loader2 v-if="savingToContactList" class="h-4 w-4 animate-spin" />
            <FolderPlus v-else class="h-4 w-4" />
            <span>Simpan ke Contact List</span>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
