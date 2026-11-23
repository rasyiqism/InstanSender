<script setup>
import { onMounted, reactive, ref } from 'vue'
import api from '../../services/api'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Alert from '../../components/ui/Alert.vue'
import { Loader2, Save, Settings, CheckCircle2, Send, AlertTriangle } from 'lucide-vue-next'

const error = ref('')
const busy = ref(false)
const saved = ref(false)
const settings = ref([])
const testingSmtp = ref(false)
const testEmailRecipient = ref('')
const smtpTestResult = ref(null)

// group settings by category for the UI
const groups = [
  { title: 'Notifikasi WhatsApp', keys: ['NOTIFICATION_WA_DEVICE_ID'] },
  { title: 'SMTP Email', keys: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM'] },
  { title: 'Akun Bank', keys: ['BANK_NAME', 'BANK_ACCOUNT_NUMBER', 'BANK_ACCOUNT_HOLDER', 'BCA_ACCOUNT_NUMBER', 'BCA_ACCOUNT_HOLDER', 'BRI_ACCOUNT_NUMBER', 'BRI_ACCOUNT_HOLDER'] },
]

const labels = {
  NOTIFICATION_WA_DEVICE_ID: 'Device ID untuk notifikasi WA',
  SMTP_HOST: 'SMTP Host',
  SMTP_PORT: 'SMTP Port',
  SMTP_SECURE: 'SMTP Secure (true/false)',
  SMTP_USER: 'SMTP Username',
  SMTP_PASSWORD: 'SMTP Password',
  MAIL_FROM: 'Email From',
  BANK_NAME: 'Nama Bank Utama',
  BANK_ACCOUNT_NUMBER: 'Nomor Rekening Utama',
  BANK_ACCOUNT_HOLDER: 'Nama Pemilik Rekening',
  BCA_ACCOUNT_NUMBER: 'Nomor Rekening BCA',
  BCA_ACCOUNT_HOLDER: 'Nama Pemilik BCA',
  BRI_ACCOUNT_NUMBER: 'Nomor Rekening BRI',
  BRI_ACCOUNT_HOLDER: 'Nama Pemilik BRI',
}

const isSecret = (key) => key.includes('PASSWORD')

const form = reactive({})

onMounted(async () => {
  error.value = ''
  try {
    const { data } = await api.get('/admin/settings')
    settings.value = data
    data.forEach((s) => {
      form[s.key] = s.value ?? ''
    })
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal memuat settings'
  }
})

async function save() {
  busy.value = true
  error.value = ''
  saved.value = false
  try {
    const items = Object.entries(form)
      .filter(([key]) => settings.value.some((s) => s.key === key))
      .map(([key, value]) => ({ key, value: String(value ?? '') }))
    await api.patch('/admin/settings', { items })
    saved.value = true
    setTimeout(() => (saved.value = false), 3000)
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal menyimpan settings'
  } finally {
    busy.value = false
  }
}

async function testSmtp() {
  if (!testEmailRecipient.value) return
  testingSmtp.value = true
  smtpTestResult.value = null
  try {
    const { data } = await api.post('/admin/settings/test-smtp', { to: testEmailRecipient.value })
    smtpTestResult.value = { success: true, message: data.message }
  } catch (err) {
    smtpTestResult.value = { success: false, message: err.response?.data?.message || 'Uji SMTP gagal' }
  } finally {
    testingSmtp.value = false
  }
}

function settingsInGroup(keys) {
  return keys.map((k) => settings.value.find((s) => s.key === k)).filter(Boolean)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">Settings</h2>
        <p class="mt-1.5 text-sm text-slate-500">
          Konfigurasi sistem: notifikasi WhatsApp, SMTP email, dan akun bank.
        </p>
      </div>
      <Button :disabled="busy" @click="save">
        <Loader2 v-if="busy" class="h-4 w-4 animate-spin" />
        <Save v-else class="h-4 w-4" />
        Simpan
      </Button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>
    <Alert v-if="saved" variant="success">
      <CheckCircle2 class="h-4 w-4" /> Settings berhasil disimpan.
    </Alert>

    <div v-if="!settings.length" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Memuat...</span>
    </div>

    <template v-else>
      <Card v-for="group in groups" :key="group.title" class="p-6">
        <div class="mb-4 flex items-center gap-2">
          <Settings class="h-5 w-5 text-slate-400" />
          <h3 class="text-lg font-bold text-slate-900">{{ group.title }}</h3>
        </div>
        <div class="space-y-4">
          <label v-for="s in settingsInGroup(group.keys)" :key="s.key" class="block space-y-1.5">
            <span class="text-sm font-medium text-slate-700">
              {{ labels[s.key] || s.key }}
              <span v-if="s.description" class="font-normal text-slate-400">— {{ s.description }}</span>
            </span>
            <input
              v-model="form[s.key]"
              :type="isSecret(s.key) ? 'password' : 'text'"
              :placeholder="s.envValue ? `(env) ${s.envValue}` : 'Kosong'"
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>

        <div v-if="group.title === 'SMTP Email'" class="mt-6 border-t border-slate-100 pt-4">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Uji Coba Pengiriman Email</p>
          <div class="flex flex-wrap items-center gap-2">
            <input
              v-model="testEmailRecipient"
              type="email"
              placeholder="Email penerima uji (contoh: user@gmail.com)"
              class="h-9 min-w-[260px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none"
            />
            <Button
              variant="outline"
              size="sm"
              :disabled="testingSmtp || !testEmailRecipient"
              @click="testSmtp"
            >
              <Loader2 v-if="testingSmtp" class="h-3.5 w-3.5 animate-spin" />
              <Send v-else class="h-3.5 w-3.5" />
              Kirim Email Uji
            </Button>
          </div>
          <p
            v-if="smtpTestResult"
            class="mt-2 text-xs font-medium"
            :class="smtpTestResult.success ? 'text-emerald-600' : 'text-rose-600'"
          >
            {{ smtpTestResult.message }}
          </p>
        </div>
      </Card>
    </template>
  </div>
</template>
