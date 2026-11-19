import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useBillingStore = defineStore('billing', () => {
  const packages = ref([])
  const payments = ref([])
  const subscription = ref(null)
  const loading = ref(false)

  async function fetchPackages() {
    const { data } = await api.get('/packages')
    packages.value = data
  }

  async function createOrder(packageId) {
    const { data } = await api.post('/billing/orders', { packageId })
    return data
  }

  async function uploadProof(orderId, file) {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post(`/billing/orders/${orderId}/proof`, form)
    return data
  }

  async function fetchPayments() {
    loading.value = true
    try {
      const { data } = await api.get('/billing/payments')
      payments.value = data
    } finally {
      loading.value = false
    }
  }

  async function fetchSubscription() {
    try {
      const { data } = await api.get('/billing/subscription')
      subscription.value = data
    } catch {
      subscription.value = null
    }
  }

  return {
    packages, payments, subscription, loading,
    fetchPackages, createOrder, uploadProof, fetchPayments, fetchSubscription,
  }
})