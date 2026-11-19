import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useDeviceStore } from '../stores/device'
import { apiBaseUrl } from '../config'

/**
 * Shared state + helpers for the integration script generators
 * (Google Form & Google Spreadsheet). Each integration page binds its
 * own form fields but reuses the copy/download + device/token logic here.
 */
export function useScriptGenerator() {
  const auth = useAuthStore()
  const devices = useDeviceStore()
  const copied = ref(false)

  // The API base used inside the generated scripts. We strip the "/api"
  // suffix and re-add it explicitly so the generated endpoint is always
  // fully qualified regardless of how apiBaseUrl is configured.
  const apiOrigin = computed(() => apiBaseUrl.replace(/\/api\/?$/, '') || '')
  const messagesEndpoint = computed(() => `${apiOrigin.value}/api/messages/send`)

  // Default token: prefer the logged-in user's token (prefilled convenience).
  const token = ref(auth.token ?? '')

  // Selected device — required, chosen from the user's connected devices.
  const deviceId = ref('')
  const selectedDevice = computed(() =>
    devices.devices.find((d) => d.id === deviceId.value),
  )

  // Load devices once so both integration pages can populate the selector.
  onMounted(async () => {
    if (!devices.devices.length) await devices.fetch()
    if (devices.devices.length && !deviceId.value) {
      deviceId.value = devices.devices[0].id
    }
  })

  function resetCopied() {
    copied.value = false
  }

  async function copyScript(script) {
    try {
      await navigator.clipboard.writeText(script)
      copied.value = true
      setTimeout(() => (copied.value = false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  function downloadScript(filename, content) {
    const blob = new Blob([content], { type: 'text/javascript;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return {
    token,
    copied,
    apiOrigin,
    messagesEndpoint,
    devices,
    deviceId,
    selectedDevice,
    resetCopied,
    copyScript,
    downloadScript,
  }
}
