import axios from 'axios'
import { apiBaseUrl } from '../config'

const api = axios.create({ baseURL: apiBaseUrl })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('instsdr_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('instsdr_token')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)

export default api
