import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useDeviceStore = defineStore('device', () => {
  const devices = ref([])
  const loading = ref(false)

  async function fetch() {
    loading.value = true
    try {
      const { data } = await api.get('/devices')
      devices.value = data
    } finally {
      loading.value = false
    }
  }

  async function create(name) {
    const { data } = await api.post('/devices', { name })
    devices.value.unshift(data.device)
    return data
  }

  async function getQr(id) {
    const { data } = await api.get(`/devices/${id}/qr`)
    return data
  }

  async function getStatus(id) {
    const { data } = await api.get(`/devices/${id}/status`)
    return data
  }

  async function remove(id) {
    await api.delete(`/devices/${id}`)
    devices.value = devices.value.filter((d) => d.id !== id)
  }

  return { devices, loading, fetch, create, getQr, getStatus, remove }
})