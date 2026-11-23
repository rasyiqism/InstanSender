<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import api from '../../services/api'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Button from '../../components/ui/Button.vue'
import Alert from '../../components/ui/Alert.vue'
import {
  ChevronLeft,
  ChevronRight,
  FileJson,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Webhook,
  X,
} from 'lucide-vue-next'

const logs = ref([])
const pagination = ref({ page: 1, total: 0, totalPages: 0 })
const filters = reactive({ eventType: '', success: '', search: '' })
const loading = ref(false)
const error = ref('')
const deletingId = ref('')
const deleteModal = ref({ open: false, log: null, loading: false })
const detailModal = ref({ open: false, log: null })

const webhookEvents = [
  { value: 'message.incoming', label: 'Incoming Message' },
  { value: 'message.status', label: 'Message Status' },
  { value: 'group.members', label: 'Group Members' },
]

const selectedIds = ref(new Set())
const bulkModal = ref({ open: false, loading: false })

const allSelected = computed(
  () => logs.value.length > 0 && logs.value.every((l) => selectedIds.value.has(l.id)),
)

async function fetchLogs(page = 1) {
  loading.value = true
  error.value = ''
  try {
    const params = { page, limit: 25 }
    if (filters.eventType) params.eventType = filters.eventType
    if (filters.success !== '') params.success = filters.success === 'true'
    if (filters.search.trim()) params.search = filters.search.trim()
    const { data } = await api.get('/logs/webhooks', { params })
    logs.value = data.data
    pagination.value = data.pagination ?? {
      page,
      limit: 25,
      total: data.total ?? 0,
      totalPages: Math.ceil((data.total ?? 0) / 25),
    }
    selectedIds.value = new Set()
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Failed to load webhook logs'
  } finally {
    loading.value = false
  }
}

let searchTimer = null
watch(
  () => [filters.eventType, filters.success],
  () => fetchLogs(1),
)
watch(filters, (val) => {
  if (val.search === '') fetchLogs(1)
})
watch(
  () => filters.search,
  () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => fetchLogs(1), 400)
  },
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
    await api.delete(`/logs/webhooks/${log.id}`)
    logs.value = logs.value.filter((l) => l.id !== log.id)
    pagination.value = {
      ...pagination.value,
      total: Math.max(0, pagination.value.total - 1),
    }
    if (!logs.value.length && pagination.value.page > 1)
      await fetchLogs(pagination.value.page - 1)
    deleteModal.value = { open: false, log: null, loading: false }
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Failed to delete webhook log'
    deleteModal.value.loading = false
  } finally {
    deletingId.value = ''
  }
}

async function confirmBulkDelete() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  bulkModal.value.loading = true
  error.value = ''
  try {
    const { data } = await api.delete('/logs/webhooks', { data: { ids } })
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
    error.value = err.response?.data?.message ?? 'Failed to delete webhook logs'
    bulkModal.value.loading = false
  }
}

function openDetail(log) {
  detailModal.value = { open: true, log }
}

function closeDetail() {
  detailModal.value = { open: false, log: null }
}

function formatPayload(payload) {
  if (!payload) return ''
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

function successVariant(ok) {
  return ok ? 'success' : 'destructive'
}

function formatDate(v) {
  if (!v) return '-'
  return new Date(v).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function shortId(id) {
  return id ? `${id.slice(0, 8)}…` : '-'
}

function resetFilters() {
  filters.eventType = ''
  filters.success = ''
  filters.search = ''
}

onMounted(() => fetchLogs())
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
          Webhook Logs
        </h2>
        <p class="mt-1.5 text-sm text-slate-500">
          Riwayat pengiriman webhook ke seluruh endpoint.
        </p>
      </div>
      <Button variant="outline" @click="fetchLogs(pagination.page)">
        <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
        <RefreshCw v-else class="h-4 w-4" />
        Refresh
      </Button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative min-w-[200px] flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          v-model="filters.search"
          type="text"
          placeholder="Cari endpoint URL..."
          class="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div class="relative">
        <Filter class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <select
          v-model="filters.eventType"
          class="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All events</option>
          <option v-for="e in webhookEvents" :key="e.value" :value="e.value">{{ e.label }}</option>
        </select>
      </div>
      <select
        v-model="filters.success"
        class="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <option value="">All results</option>
        <option value="true">Success</option>
        <option value="false">Failed</option>
      </select>
      <Button
        v-if="filters.eventType || filters.success || filters.search"
        variant="ghost"
        size="sm"
        @click="resetFilters"
      >
        <X class="h-4 w-4" />
        Reset
      </Button>
    </div>

    <!-- Bulk toolbar -->
    <div
      v-if="selectedIds.size > 0"
      class="flex flex-wrap items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5"
    >
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
      <span class="ml-2 text-sm text-slate-500">Loading webhook logs…</span>
    </div>

    <!-- Empty -->
    <Card v-else-if="!logs.length" class="flex flex-col items-center p-12 text-center">
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
        <Webhook class="h-7 w-7" />
      </div>
      <p class="text-lg font-bold text-slate-900">No webhook logs yet</p>
      <p class="mt-1 text-sm text-slate-500">Webhook delivery attempts will appear here.</p>
    </Card>

    <!-- Table -->
    <Card v-else class="overflow-hidden p-0 shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/80">
              <th class="w-10 px-5 py-3.5">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  @change="toggleAll($event)"
                  class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                />
              </th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Endpoint</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Event</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Result</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Response</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
              <th class="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="log in logs" :key="log.id" class="transition-colors hover:bg-slate-50/50">
              <td class="px-5 py-4">
                <input
                  type="checkbox"
                  :checked="selectedIds.has(log.id)"
                  @change="toggleSelect(log.id)"
                  class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                />
              </td>
              <td class="max-w-[280px] px-5 py-4">
                <p class="break-all font-mono text-xs font-semibold text-slate-900">{{ log.url }}</p>
                <p class="mt-1 text-xs text-slate-400">{{ shortId(log.id) }}</p>
              </td>
              <td class="px-5 py-4">
                <Badge variant="secondary">{{ log.eventType }}</Badge>
              </td>
              <td class="px-5 py-4">
                <Badge :variant="successVariant(log.success)">{{ log.success ? 'success' : 'failed' }}</Badge>
              </td>
              <td class="px-5 py-4 text-slate-600">
                <p>{{ log.responseStatus ?? '-' }}</p>
                <p v-if="log.durationMs !== null" class="text-xs text-slate-400">{{ log.durationMs }} ms</p>
                <p
                  v-if="log.errorMessage"
                  class="max-w-[160px] truncate text-xs text-red-500"
                  :title="log.errorMessage"
                >
                  {{ log.errorMessage }}
                </p>
              </td>
              <td class="px-5 py-4 text-sm text-slate-500">{{ formatDate(log.createdAt) }}</td>
              <td class="px-5 py-4 text-right">
                <div class="inline-flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="View payload"
                    class="text-slate-400 hover:bg-primary-50 hover:text-primary"
                    @click="openDetail(log)"
                  >
                    <FileJson class="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete log"
                    class="text-slate-400 hover:bg-red-50 hover:text-red-600"
                    :disabled="deletingId === log.id"
                    @click="openDelete(log)"
                  >
                    <Loader2 v-if="deletingId === log.id" class="h-4 w-4 animate-spin" />
                    <Trash2 v-else class="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 0" class="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p class="text-sm text-slate-500">
        {{ pagination.total.toLocaleString() }} total log{{ pagination.total !== 1 ? 's' : '' }}
      </p>
      <div class="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          :disabled="pagination.page <= 1"
          class="gap-1"
          @click="fetchLogs(pagination.page - 1)"
        >
          <ChevronLeft class="h-3.5 w-3.5" /> Prev
        </Button>
        <span class="text-sm tabular-nums text-slate-600">
          Page {{ pagination.page }} of {{ pagination.totalPages || 1 }}
        </span>
        <Button
          variant="outline"
          size="sm"
          :disabled="pagination.page >= pagination.totalPages"
          class="gap-1"
          @click="fetchLogs(pagination.page + 1)"
        >
          Next <ChevronRight class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>

    <!-- Detail modal -->
    <div
      v-if="detailModal.open && detailModal.log"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="closeDetail"
    >
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto p-0 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div class="flex items-center gap-2">
            <FileJson class="h-4 w-4 text-primary" />
            <h3 class="font-semibold text-slate-900">Webhook Payload</h3>
          </div>
          <Button variant="ghost" size="icon" @click="closeDetail">
            <X class="h-4 w-4" />
          </Button>
        </div>

        <div class="space-y-4 p-5">
          <div class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Event</p>
              <Badge variant="secondary">{{ detailModal.log.eventType }}</Badge>
            </div>
            <div>
              <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Result</p>
              <Badge :variant="successVariant(detailModal.log.success)">
                {{ detailModal.log.success ? 'success' : 'failed' }}
              </Badge>
            </div>
            <div>
              <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">HTTP</p>
              <p class="font-medium text-slate-900">{{ detailModal.log.responseStatus ?? '-' }}</p>
            </div>
            <div>
              <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Duration</p>
              <p class="font-medium text-slate-900">
                {{ detailModal.log.durationMs != null ? detailModal.log.durationMs + ' ms' : '-' }}
              </p>
            </div>
          </div>

          <div>
            <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Date</p>
            <p class="text-sm text-slate-700">{{ formatDate(detailModal.log.createdAt) }}</p>
          </div>

          <div>
            <p class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Endpoint</p>
            <p class="break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 ring-1 ring-slate-200">
              {{ detailModal.log.url }}
            </p>
          </div>

          <div v-if="detailModal.log.errorMessage">
            <p class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Error</p>
            <p class="break-all rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-100">
              {{ detailModal.log.errorMessage }}
            </p>
          </div>

          <div>
            <p class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Payload</p>
            <pre class="max-h-80 overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100 ring-1 ring-slate-800">{{ formatPayload(detailModal.log.payload) }}</pre>
          </div>
        </div>
      </Card>
    </div>

    <!-- Delete modal -->
    <div
      v-if="deleteModal.open && deleteModal.log"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="closeDelete"
    >
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-0 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 class="font-semibold text-slate-900">Hapus Webhook Log</h3>
          <Button variant="ghost" size="icon" :disabled="deleteModal.loading" @click="closeDelete">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="flex flex-col items-center gap-3 p-6 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
            <Trash2 class="h-6 w-6" />
          </div>
          <div>
            <p class="font-semibold text-slate-900">Hapus log ini?</p>
            <p class="mt-1 break-all font-mono text-xs text-slate-500">{{ deleteModal.log.url }}</p>
            <p class="mt-2 text-sm text-slate-500">
              Log ini akan dihapus secara permanen dan tidak dapat dikembalikan.
            </p>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <Button variant="outline" :disabled="deleteModal.loading" @click="closeDelete">Batal</Button>
          <Button
            variant="destructive"
            :disabled="deleteModal.loading"
            class="gap-1.5"
            @click="confirmDelete"
          >
            <Loader2 v-if="deleteModal.loading" class="h-4 w-4 animate-spin" />
            <Trash2 v-else class="h-4 w-4" />
            {{ deleteModal.loading ? 'Menghapus…' : 'Hapus Log' }}
          </Button>
        </div>
      </Card>
    </div>

    <!-- Bulk delete modal -->
    <div
      v-if="bulkModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      @click.self="!bulkModal.loading && (bulkModal.open = false)"
    >
      <Card class="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-0 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 class="font-semibold text-slate-900">Delete {{ selectedIds.size }} Webhook Logs</h3>
          <Button variant="ghost" size="icon" :disabled="bulkModal.loading" @click="bulkModal.open = false">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="flex flex-col items-center gap-3 p-6 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
            <Trash2 class="h-6 w-6" />
          </div>
          <div>
            <p class="font-semibold text-slate-900">
              Delete {{ selectedIds.size }} log{{ selectedIds.size !== 1 ? 's' : '' }}?
            </p>
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
