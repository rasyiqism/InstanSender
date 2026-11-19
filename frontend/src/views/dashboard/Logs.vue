<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '../../services/api'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Button from '../../components/ui/Button.vue'
import Alert from '../../components/ui/Alert.vue'
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  RefreshCw,
  ScrollText,
  Trash2,
  X,
} from 'lucide-vue-next'

// ── message logs ──────────────────────────────────────────────────
const logs = ref([])
const pagination = ref({ page: 1, total: 0, totalPages: 0 })
const statusFilter = ref('')
const loading = ref(false)
const error = ref('')

async function fetchLogs(page = 1) {
  loading.value = true
  error.value = ''
  try {
    const params = { page, limit: 25 }
    if (statusFilter.value) params.status = statusFilter.value
    const { data } = await api.get('/logs', { params })
    logs.value = data.data
    pagination.value = data.pagination
    selectedIds.value = new Set()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Failed to load message logs'
  } finally {
    loading.value = false
  }
}

watch(statusFilter, () => fetchLogs(1))

// ── log delete ────────────────────────────────────────────────────
const deletingId = ref('')
const deleteModal = ref({ open: false, log: null, loading: false })

function openDelete(log) {
  deleteModal.value = { open: true, log, loading: false }
}

function closeDelete() {
  if (deleteModal.value.loading) return
  deleteModal.value = { open: false, log: null, loading: false }
}

async function confirmDelete() {
  const log = deleteModal.value.log
  if (!log) return
  deleteModal.value.loading = true
  deletingId.value = log.id
  error.value = ''
  try {
    await api.delete(`/logs/${log.id}`)
    logs.value = logs.value.filter((l) => l.id !== log.id)
    pagination.value = {
      ...pagination.value,
      total: Math.max(0, pagination.value.total - 1),
    }
    if (!logs.value.length && pagination.value.page > 1)
      await fetchLogs(pagination.value.page - 1)
    deleteModal.value = { open: false, log: null, loading: false }
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Failed to delete message log'
    deleteModal.value.loading = false
  } finally {
    deletingId.value = ''
  }
}

// ── bulk delete ───────────────────────────────────────────────────
const selectedIds = ref(new Set())
const bulkModal = ref({ open: false, loading: false })
const allSelected = computed(
  () => logs.value.length > 0 && logs.value.every((l) => selectedIds.value.has(l.id)),
)

function toggleSelect(id) {
  const next = new Set(selectedIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selectedIds.value = next
}

function toggleAll(e) {
  const next = new Set(selectedIds.value)
  if (e.target.checked) logs.value.forEach((l) => next.add(l.id))
  else logs.value.forEach((l) => next.delete(l.id))
  selectedIds.value = next
}

function clearSelection() {
  selectedIds.value = new Set()
}

async function confirmBulkDelete() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  bulkModal.value.loading = true
  error.value = ''
  try {
    const { data } = await api.delete('/logs/batch', { data: { ids } })
    const deleted = data.deleted ?? ids.length
    logs.value = logs.value.filter((l) => !selectedIds.value.has(l.id))
    pagination.value = {
      ...pagination.value,
      total: Math.max(0, pagination.value.total - deleted),
    }
    selectedIds.value = new Set()
    bulkModal.value = { open: false, loading: false }
    if (!logs.value.length && pagination.value.page > 1)
      await fetchLogs(pagination.value.page - 1)
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Failed to delete message logs'
    bulkModal.value.loading = false
  }
}

// ── mount ─────────────────────────────────────────────────────────
onMounted(() => fetchLogs())

// ── helpers ───────────────────────────────────────────────────────
function statusVariant(status) {
  if (status === 'sent' || status === 'delivered') return 'success'
  if (status === 'queued') return 'warning'
  if (status === 'failed') return 'destructive'
  return 'default'
}

function formatDate(v) {
  if (!v) return '-'
  return new Date(v).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="space-y-6">

    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">Logs</h2>
        <p class="mt-1.5 text-sm text-slate-500">Track message delivery history.</p>
      </div>
      <Button variant="outline" @click="fetchLogs(pagination.page)">
        <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
        <RefreshCw v-else class="h-4 w-4" />
        Refresh
      </Button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <!-- Filter -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative">
        <Filter class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <select v-model="statusFilter"
          class="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">All statuses</option>
          <option value="queued">Queued</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
        </select>
      </div>
    </div>

    <!-- Bulk toolbar -->
    <div v-if="selectedIds.size > 0"
      class="flex flex-wrap items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5">
      <span class="text-sm font-semibold text-primary-800">{{ selectedIds.size }} selected</span>
      <div class="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" @click="clearSelection">Clear</Button>
        <Button variant="destructive" size="sm" class="gap-1.5" @click="bulkModal.open = true">
          <Trash2 class="h-3.5 w-3.5" />
          Delete selected
        </Button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Loading logs…</span>
    </div>

    <!-- Empty -->
    <Card v-else-if="!logs.length" class="flex flex-col items-center p-12 text-center">
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
        <ScrollText class="h-7 w-7" />
      </div>
      <p class="text-lg font-bold text-slate-900">No message logs yet</p>
      <p class="mt-1 text-sm text-slate-500">Send a message via the API to see it appear here.</p>
    </Card>

    <!-- Table -->
    <Card v-else class="overflow-hidden p-0 shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/80">
              <th class="w-10 px-5 py-3.5">
                <input type="checkbox" :checked="allSelected"
                  @change="toggleAll($event)"
                  class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40" />
              </th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Recipient</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
              <th class="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="l in logs" :key="l.id" class="transition-colors hover:bg-slate-50/50">
              <td class="px-5 py-4">
                <input type="checkbox" :checked="selectedIds.has(l.id)"
                  @change="toggleSelect(l.id)"
                  class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40" />
              </td>
              <td class="px-5 py-4 font-medium text-slate-900">{{ l.recipient }}</td>
              <td class="px-5 py-4 text-slate-600">{{ l.messageType }}</td>
              <td class="px-5 py-4"><Badge :variant="statusVariant(l.status)">{{ l.status }}</Badge></td>
              <td class="px-5 py-4 text-sm text-slate-500">{{ formatDate(l.createdAt) }}</td>
              <td class="px-5 py-4 text-right">
                <Button variant="ghost" size="icon" title="Delete log"
                  class="text-slate-400 hover:bg-red-50 hover:text-red-600"
                  :disabled="deletingId === l.id"
                  @click="openDelete(l)">
                  <Loader2 v-if="deletingId === l.id" class="h-4 w-4 animate-spin" />
                  <Trash2 v-else class="h-4 w-4" />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 0" class="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p class="text-sm text-slate-500">{{ pagination.total.toLocaleString() }} total log{{ pagination.total !== 1 ? 's' : '' }}</p>
      <div class="flex items-center gap-3">
        <Button variant="outline" size="sm" :disabled="pagination.page <= 1" class="gap-1" @click="fetchLogs(pagination.page - 1)">
          <ChevronLeft class="h-3.5 w-3.5" /> Prev
        </Button>
        <span class="text-sm tabular-nums text-slate-600">Page {{ pagination.page }} of {{ pagination.totalPages || 1 }}</span>
        <Button variant="outline" size="sm" :disabled="pagination.page >= pagination.totalPages" class="gap-1" @click="fetchLogs(pagination.page + 1)">
          Next <ChevronRight class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>

    <!-- ═══════════════════ DELETE MODAL ═══════════════════ -->
    <div v-if="deleteModal.open && deleteModal.log"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="closeDelete">
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-0 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 class="font-semibold text-slate-900">Delete Message Log</h3>
          <Button variant="ghost" size="icon" @click="closeDelete" :disabled="deleteModal.loading">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="flex flex-col items-center gap-3 p-6 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
            <Trash2 class="h-6 w-6" />
          </div>
          <div>
            <p class="font-semibold text-slate-900">Delete this log?</p>
            <p class="mt-1 font-mono text-xs text-slate-500">{{ deleteModal.log.recipient }}</p>
            <p class="mt-2 text-sm text-slate-500">
              This log will be permanently deleted and cannot be undone.
            </p>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <Button variant="outline" @click="closeDelete" :disabled="deleteModal.loading">
            Cancel
          </Button>
          <Button variant="destructive" @click="confirmDelete" :disabled="deleteModal.loading" class="gap-1.5">
            <Loader2 v-if="deleteModal.loading" class="h-4 w-4 animate-spin" />
            <Trash2 v-else class="h-4 w-4" />
            {{ deleteModal.loading ? 'Deleting…' : 'Delete Log' }}
          </Button>
        </div>
      </Card>
    </div>

    <!-- ═══════════════════ BULK DELETE MODAL ═══════════════════ -->
    <div v-if="bulkModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="!bulkModal.loading && (bulkModal.open = false)">
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-0 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 class="font-semibold text-slate-900">Delete {{ selectedIds.size }} Message Logs</h3>
          <Button variant="ghost" size="icon" :disabled="bulkModal.loading" @click="bulkModal.open = false">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="flex flex-col items-center gap-3 p-6 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
            <Trash2 class="h-6 w-6" />
          </div>
          <div>
            <p class="font-semibold text-slate-900">Delete {{ selectedIds.size }} log{{ selectedIds.size !== 1 ? 's' : '' }}?</p>
            <p class="mt-2 text-sm text-slate-500">
              These logs will be permanently deleted and cannot be undone.
            </p>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <Button variant="outline" :disabled="bulkModal.loading" @click="bulkModal.open = false">Cancel</Button>
          <Button variant="destructive" :disabled="bulkModal.loading" class="gap-1.5" @click="confirmBulkDelete">
            <Loader2 v-if="bulkModal.loading" class="h-4 w-4 animate-spin" />
            <Trash2 v-else class="h-4 w-4" />
            {{ bulkModal.loading ? 'Deleting…' : 'Delete Logs' }}
          </Button>
        </div>
      </Card>
    </div>

  </div>
</template>
