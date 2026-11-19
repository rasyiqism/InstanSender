import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useWebhookStore = defineStore('webhook', () => {
  const webhooks = ref([])
  const loading = ref(false)

  async function fetch() {
    loading.value = true
    try {
      const { data } = await api.get('/webhooks')
      webhooks.value = data
    } finally {
      loading.value = false
    }
  }

  async function create(payload) {
    const { data } = await api.post('/webhooks', payload)
    webhooks.value.unshift(data)
    return data
  }

  async function remove(id) {
    await api.delete(`/webhooks/${id}`)
    webhooks.value = webhooks.value.filter((webhook) => webhook.id !== id)
  }

  return { webhooks, loading, fetch, create, remove }
})
