import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('instsdr_user') ?? 'null'))
  const token = ref(localStorage.getItem('instsdr_token'))

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isAgency = computed(() => user.value?.role === 'agency')

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    setSession(data)
    return data
  }

  async function register(name, email, password, phone) {
    const phoneNumber = (phone ?? '').replace(/\+/g, '').trim()
    const { data } = await api.post('/auth/register', { name, email, password, phoneNumber })
    setSession(data)
    return data
  }

  function setSession(data) {
    user.value = data.user
    token.value = data.accessToken
    localStorage.setItem('instsdr_token', data.accessToken)
    localStorage.setItem('instsdr_user', JSON.stringify(data.user))
  }

  // Update the current user's profile (name, email, phoneNumber).
  async function updateProfile(payload) {
    const { data } = await api.put('/auth/profile', payload)
    if (data?.user ?? data) {
      user.value = data.user ?? data
      localStorage.setItem('instsdr_user', JSON.stringify(user.value))
    }
    return data
  }

  // Change the current user's password.
  async function updatePassword(payload) {
    const { data } = await api.put('/auth/password', payload)
    return data
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('instsdr_token')
    localStorage.removeItem('instsdr_user')
  }

  async function registerAgency(payload) {
    const { data } = await api.post('/auth/register-agency', payload)
    return data
  }

  return { user, token, isLoggedIn, isAdmin, isAgency, login, register, registerAgency, updateProfile, updatePassword, logout }
})