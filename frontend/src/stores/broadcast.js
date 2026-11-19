import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useBroadcastStore = defineStore('broadcast', () => {
  const contactLists = ref([])
  const broadcasts = ref([])
  const loading = ref(false)

  // ---- Contact lists ----
  async function fetchContactLists() {
    loading.value = true
    try {
      const { data } = await api.get('/contact-lists')
      contactLists.value = data
    } finally {
      loading.value = false
    }
  }

  async function createContactList(name) {
    const { data } = await api.post('/contact-lists', { name })
    contactLists.value.unshift(data)
    return data
  }

  async function getContactList(id) {
    const { data } = await api.get(`/contact-lists/${id}`)
    return data
  }

  async function deleteContactList(id) {
    await api.delete(`/contact-lists/${id}`)
    contactLists.value = contactLists.value.filter((l) => l.id !== id)
  }

  async function addContact(listId, phoneNumber, name) {
    const { data } = await api.post(`/contact-lists/${listId}/contacts`, {
      phoneNumber,
      name,
    })
    return data
  }

  async function deleteContact(listId, contactId) {
    await api.delete(`/contact-lists/${listId}/contacts/${contactId}`)
  }

  async function importCsv(listId, file) {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post(`/contact-lists/${listId}/import-csv`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  }

  // ---- Broadcasts ----
  async function fetchBroadcasts() {
    loading.value = true
    try {
      const { data } = await api.get('/broadcasts')
      broadcasts.value = data
    } finally {
      loading.value = false
    }
  }

  async function createBroadcast(payload) {
    const { data } = await api.post('/broadcasts', payload)
    broadcasts.value.unshift(data)
    return data
  }

  async function getBroadcast(id) {
    const { data } = await api.get(`/broadcasts/${id}`)
    return data
  }

  return {
    contactLists,
    broadcasts,
    loading,
    fetchContactLists,
    createContactList,
    getContactList,
    deleteContactList,
    addContact,
    deleteContact,
    importCsv,
    fetchBroadcasts,
    createBroadcast,
    getBroadcast,
  }
})
