import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useApiKeyStore = defineStore('apiKey', () => {
  const keys = ref([])
  const loading = ref(false)

  async function fetch() {
    loading.value = true
    try {
      const { data } = await api.get('/api-keys')
      keys.value = data
    } finally {
      loading.value = false
    }
  }

  async function generate(deviceId) {
    const { data } = await api.post('/api-keys', { deviceId })
    keys.value.unshift(data)
    return data
  }

  async function revoke(id) {
    await api.delete(`/api-keys/${id}`)
    keys.value = keys.value.filter((k) => k.id !== id)
  }

  return { keys, loading, fetch, generate, revoke }
})