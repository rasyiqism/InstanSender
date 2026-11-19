<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import api from '../../services/api'
import Button from '../../components/ui/Button.vue'
import Alert from '../../components/ui/Alert.vue'
import { appName } from '../../config'
import {
  Mail,
  Lock,
  Phone,
  User,
  Building2,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
} from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()

const packages = ref([])
const selectedPackage = ref('')
const error = ref('')
const busy = ref(false)
const success = ref(false)
const showPassword = ref(false)

const form = reactive({
  name: '',
  email: '',
  phone: '',
  password: '',
})

onMounted(async () => {
  try {
    const { data } = await api.get('/agency-packages')
    packages.value = data
    if (data.length) selectedPackage.value = data[0].id
  } catch {
    error.value = 'Gagal memuat paket agency'
  }
})

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const phoneNumber = (form.phone ?? '').replace(/\+/g, '').trim()
    await auth.registerAgency({
      name: form.name,
      email: form.email,
      password: form.password,
      phoneNumber: phoneNumber || undefined,
      packageId: selectedPackage.value,
    })
    success.value = true
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal mendaftar agency'
  } finally {
    busy.value = false
  }
}

function formatPrice(price) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(price))
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 lg:grid lg:grid-cols-2">
    <!-- Left: form -->
    <div class="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-12">
      <div class="mx-auto w-full max-w-md">
        <button class="mb-8 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900" @click="router.push('/login')">
          ← Kembali ke Login
        </button>

        <div class="mb-8">
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">Daftar sebagai Agency</h1>
          <p class="mt-1.5 text-sm text-slate-500">Jadi reseller dan kelola user Anda sendiri.</p>
        </div>

        <Alert v-if="success" variant="success" class="mb-6">
          <CheckCircle2 class="h-4 w-4" />
          <div>
            <p class="font-semibold">Pendaftaran agency berhasil!</p>
            <p class="mt-1 text-sm">Subscription Anda sedang menunggu aktivasi admin. Anda akan dapat login setelah admin mengaktifkan akun agency Anda.</p>
            <Button variant="outline" size="sm" class="mt-3" @click="router.push('/login')">Ke Login</Button>
          </div>
        </Alert>

        <form v-else class="space-y-4" @submit.prevent="submit">
          <Alert v-if="error" variant="destructive">{{ error }}</Alert>

          <label class="block space-y-1.5">
            <span class="text-sm font-medium text-slate-700">Nama Agency</span>
            <div class="relative">
              <Building2 class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input v-model="form.name" type="text" required placeholder="Digital Agency" class="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </label>

          <label class="block space-y-1.5">
            <span class="text-sm font-medium text-slate-700">Email</span>
            <div class="relative">
              <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input v-model="form.email" type="email" required placeholder="agency@example.com" class="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <span class="text-xs text-slate-400">Jika email sudah terdaftar sebagai user, akun akan di-upgrade ke agency.</span>
          </label>

          <label class="block space-y-1.5">
            <span class="text-sm font-medium text-slate-700">Nomor WhatsApp</span>
            <div class="relative">
              <Phone class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input v-model="form.phone" type="tel" placeholder="628123456789" class="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </label>

          <label class="block space-y-1.5">
            <span class="text-sm font-medium text-slate-700">Password</span>
            <div class="relative">
              <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input v-model="form.password" :type="showPassword ? 'text' : 'password'" required minlength="8" placeholder="Minimal 8 karakter" class="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" @click="showPassword = !showPassword">
                <Eye v-if="!showPassword" class="h-5 w-5" />
                <EyeOff v-else class="h-5 w-5" />
              </button>
            </div>
          </label>

          <!-- Package selection -->
          <div class="space-y-1.5">
            <span class="text-sm font-medium text-slate-700">Pilih Paket Agency</span>
            <div v-if="!packages.length" class="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 class="h-4 w-4 animate-spin" /> Memuat paket...
            </div>
            <div v-else class="space-y-2">
              <label
                v-for="pkg in packages"
                :key="pkg.id"
                :class="[
                  'flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all',
                  selectedPackage === pkg.id
                    ? 'border-primary bg-primary-50 ring-2 ring-primary/20'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                ]"
              >
                <div class="flex items-center gap-3">
                  <input v-model="selectedPackage" :value="pkg.id" type="radio" class="h-4 w-4 text-primary" />
                  <div>
                    <p class="font-semibold text-slate-900">{{ pkg.name }}</p>
                    <p class="text-xs text-slate-500">{{ pkg.activationLimit ?? pkg.deviceQuota }}x aktivasi {{ pkg.allowedPackages?.length ? pkg.allowedPackages.join('/') : '' }} · {{ pkg.durationDays }} hari</p>
                  </div>
                </div>
                <p class="font-bold text-primary">{{ formatPrice(pkg.price) }}</p>
              </label>
            </div>
          </div>

          <Button type="submit" :disabled="busy || !selectedPackage" class="h-11 w-full">
            <Loader2 v-if="busy" class="h-4 w-4 animate-spin" />
            Daftar sebagai Agency
          </Button>

          <p class="text-center text-sm text-slate-500">
            Sudah punya akun?
            <router-link to="/login" class="font-medium text-primary hover:underline">Login</router-link>
          </p>
        </form>
      </div>
    </div>

    <!-- Right: brand panel -->
    <div class="hidden bg-linear-to-br from-teal-600 to-teal-800 lg:flex lg:flex-col lg:justify-center lg:px-12">
      <div class="mx-auto max-w-md text-white">
        <Building2 class="mb-6 h-12 w-12" />
        <h2 class="text-3xl font-bold tracking-tight">Jadi Reseller Agency</h2>
        <p class="mt-3 text-teal-100">Kelola user Anda sendiri, distribusikan device quota, dan kembangkan bisnis WhatsApp Gateway Anda.</p>
        <ul class="mt-8 space-y-3 text-sm text-teal-50">
          <li class="flex items-center gap-2"><CheckCircle2 class="h-4 w-4" /> Buat user dan kelola subscription</li>
          <li class="flex items-center gap-2"><CheckCircle2 class="h-4 w-4" /> Distribusikan device quota ke user Anda</li>
          <li class="flex items-center gap-2"><CheckCircle2 class="h-4 w-4" /> Dashboard reseller real-time</li>
          <li class="flex items-center gap-2"><CheckCircle2 class="h-4 w-4" /> Multi-tenant isolation</li>
        </ul>
      </div>
    </div>
  </div>
</template>
