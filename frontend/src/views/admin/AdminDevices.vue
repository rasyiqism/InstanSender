<script setup>
import { onMounted, ref } from 'vue'
import api from '../../services/api'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import { Server, Loader2 } from 'lucide-vue-next'

const devices = ref([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await api.get('/admin/devices')
    devices.value = data
  } finally {
    loading.value = false
  }
})

function statusVariant(status) {
  if (status === 'connected') return 'success'
  if (status === 'reconnecting') return 'info'
  if (status === 'pending_qr') return 'warning'
  return 'destructive'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">All Devices</h2>
      <p class="mt-1.5 text-sm text-slate-500">Monitor all connected devices across users.</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Loading devices...</span>
    </div>

    <!-- Table -->
    <Card v-else class="overflow-hidden p-0 shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/80">
              <th class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Owner</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Phone</th>
              <th class="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="d in devices" :key="d.id" class="transition-colors hover:bg-slate-50/50">
              <td class="px-5 py-4 font-medium text-slate-900">{{ d.user?.email }}</td>
              <td class="px-5 py-4 text-slate-600">{{ d.name }}</td>
              <td class="px-5 py-4 text-slate-600">{{ d.phoneNumber ?? '—' }}</td>
              <td class="px-5 py-4">
                <Badge :variant="statusVariant(d.status)" class="text-xs">{{ d.status }}</Badge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  </div>
</template>
