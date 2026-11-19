import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useAutoReplyStore = defineStore('autoReply', () => {
  // rules keyed by deviceId: { [deviceId]: { enabled, rules } }
  const settings = ref({})
  const loading = ref(false)

  async function fetch(deviceId) {
    loading.value = true
    try {
      const { data } = await api.get(`/devices/${deviceId}/auto-reply`)
      settings.value = { ...settings.value, [deviceId]: data }
      return data
    } finally {
      loading.value = false
    }
  }

  async function setEnabled(deviceId, enabled) {
    const { data } = await api.patch(`/devices/${deviceId}/auto-reply`, { enabled })
    const current = settings.value[deviceId] ?? { rules: [] }
    settings.value = { ...settings.value, [deviceId]: { ...current, enabled: data.enabled } }
    return data
  }

  async function createRule(deviceId, payload) {
    const { data } = await api.post(`/devices/${deviceId}/auto-reply/rules`, payload)
    const current = settings.value[deviceId] ?? { enabled: false, rules: [] }
    settings.value = {
      ...settings.value,
      [deviceId]: { ...current, rules: [...current.rules, data] },
    }
    return data
  }

  async function updateRule(deviceId, ruleId, payload) {
    const { data } = await api.patch(
      `/devices/${deviceId}/auto-reply/rules/${ruleId}`,
      payload,
    )
    const current = settings.value[deviceId] ?? { enabled: false, rules: [] }
    settings.value = {
      ...settings.value,
      [deviceId]: {
        ...current,
        rules: current.rules.map((r) => (r.id === ruleId ? data : r)),
      },
    }
    return data
  }

  async function deleteRule(deviceId, ruleId) {
    await api.delete(`/devices/${deviceId}/auto-reply/rules/${ruleId}`)
    const current = settings.value[deviceId] ?? { enabled: false, rules: [] }
    settings.value = {
      ...settings.value,
      [deviceId]: {
        ...current,
        rules: current.rules.filter((r) => r.id !== ruleId),
      },
    }
  }

  return { settings, loading, fetch, setEnabled, createRule, updateRule, deleteRule }
})
