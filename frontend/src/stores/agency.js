import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useAgencyStore = defineStore('agency', () => {
  const dashboard = ref(null)
  const users = ref([])
  const agencyPackages = ref([])
  const agencies = ref([])
  const loading = ref(false)

  // ---- Agency-scoped (JWT agency role) ----
  async function fetchDashboard() {
    const { data } = await api.get('/agency/dashboard')
    dashboard.value = data
    return data
  }

  async function fetchUsers() {
    const { data } = await api.get('/agency/users')
    users.value = data
    return data
  }

  async function createUser(payload) {
    const { data } = await api.post('/agency/users', payload)
    users.value.unshift(data)
    return data
  }

  async function renewUser(id, durationDays) {
    const { data } = await api.post(`/agency/users/${id}/renew`, { durationDays })
    return data
  }

  async function suspendUser(id) {
    const { data } = await api.post(`/agency/users/${id}/suspend`)
    return data
  }

  async function activateUser(id) {
    const { data } = await api.post(`/agency/users/${id}/activate`)
    return data
  }

  // ---- Public: agency packages for registration ----
  async function fetchAgencyPackagesPublic() {
    // no auth needed — but backend doesn't have a public list endpoint,
    // so agencies pick package during register. We expose packages via admin.
    // For the register page, we'll fetch via a lightweight public call if available.
    // Fallback: empty — packages passed from backend response or admin.
  }

  // ---- Admin-scoped ----
  async function adminFetchAgencyPackages() {
    const { data } = await api.get('/admin/agency-packages')
    agencyPackages.value = data
    return data
  }

  async function adminCreateAgencyPackage(payload) {
    const { data } = await api.post('/admin/agency-packages', payload)
    agencyPackages.value.push(data)
    return data
  }

  async function adminDeleteAgencyPackage(id) {
    await api.delete(`/admin/agency-packages/${id}`)
    agencyPackages.value = agencyPackages.value.filter((p) => p.id !== id)
  }

  async function adminUpdateAgencyPackage(id, payload) {
    const { data } = await api.patch(`/admin/agency-packages/${id}`, payload)
    const idx = agencyPackages.value.findIndex((p) => p.id === id)
    if (idx >= 0) agencyPackages.value[idx] = data
    return data
  }

  async function adminFetchAgencies() {
    const { data } = await api.get('/admin/agencies')
    agencies.value = data
    return data
  }

  async function adminActivateAgency(id) {
    const { data } = await api.post(`/admin/agencies/${id}/activate`)
    return data
  }

  async function adminSuspendAgency(id) {
    const { data } = await api.post(`/admin/agencies/${id}/suspend`)
    return data
  }

  return {
    dashboard,
    users,
    agencyPackages,
    agencies,
    loading,
    fetchDashboard,
    fetchUsers,
    createUser,
    renewUser,
    suspendUser,
    activateUser,
    adminFetchAgencyPackages,
    adminCreateAgencyPackage,
    adminDeleteAgencyPackage,
    adminUpdateAgencyPackage,
    adminFetchAgencies,
    adminActivateAgency,
    adminSuspendAgency,
  }
})
