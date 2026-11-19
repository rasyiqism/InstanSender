<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import Button from '../../components/ui/Button.vue'
import Alert from '../../components/ui/Alert.vue'
import { appName } from '../../config'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Zap,
  ShieldCheck,
  BarChart3,
} from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)
const showPassword = ref(false)

const features = [
  { icon: Zap, title: 'Pengiriman super cepat', desc: 'Pesan sampai dalam hitungan detik.' },
  { icon: ShieldCheck, title: 'Aman & andal', desc: 'Enkripsi tingkat enterprise, selalu aktif.' },
  { icon: BarChart3, title: 'Analitik real-time', desc: 'Pantau pembukaan, klik, dan konversi.' },
]

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await auth.login(email.value, password.value)
    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal masuk'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="relative min-h-screen lg:grid lg:grid-cols-2">
    <!-- Brand / feature panel -->
    <div class="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-primary-600 via-primary-700 to-primary-800 p-12 text-white lg:flex xl:p-16">
      <!-- Decorative layers -->
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_0)] bg-size-[26px_26px]" />
      <div class="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-primary-400/30 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-primary-500/30 blur-3xl" />

      <!-- Logo -->
      <div class="relative flex items-center">
        <img
          src="/logo.png"
          :alt="appName"
          class="h-9 w-auto select-none brightness-0 invert"
        />
      </div>

      <!-- Headline + features -->
      <div class="relative max-w-md">
        <h2 class="text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
          Jangkau setiap pelanggan di WhatsApp
        </h2>
        <p class="mt-4 text-base leading-relaxed text-primary-50/80">
          Kirim broadcast, otomatisasi, dan pantau notifikasi WhatsApp — semua
          dari satu dashboard yang sederhana dan powerful.
        </p>

        <ul class="mt-10 space-y-5">
          <li v-for="f in features" :key="f.title" class="flex items-start gap-4">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
              <component :is="f.icon" class="h-5 w-5" />
            </div>
            <div>
              <p class="font-semibold leading-tight">{{ f.title }}</p>
              <p class="text-sm text-primary-50/70">{{ f.desc }}</p>
            </div>
          </li>
        </ul>
      </div>

      <!-- Footer note -->
      <p class="relative text-sm text-primary-50/60">
        © {{ new Date().getFullYear() }} {{ appName }}. Seluruh hak cipta dilindungi.
      </p>
    </div>

    <!-- Form panel -->
    <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-12 sm:px-6 lg:px-8">
      <div class="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full bg-primary-100/50 blur-3xl lg:hidden" />

      <div class="relative w-full max-w-sm">
        <!-- Mobile logo -->
        <div class="mb-8 flex items-center justify-center lg:hidden">
          <img src="/logo.png" :alt="appName" class="h-9 w-auto select-none" />
        </div>

        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Selamat datang kembali</h1>
          <p class="mt-2 text-sm text-slate-500">Masuk ke dashboard {{ appName }} Anda</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="submit" class="space-y-5">
          <Alert v-if="error" variant="destructive" class="text-sm">{{ error }}</Alert>

          <div class="space-y-2.5">
            <label for="email" class="text-sm font-medium text-slate-700">Email</label>
            <div class="relative">
              <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                v-model="email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                required
                class="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 py-2 text-sm ring-offset-white transition-all duration-200 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary"
              />
            </div>
          </div>

          <div class="space-y-2.5">
            <label for="password" class="text-sm font-medium text-slate-700">Password</label>
            <div class="relative">
              <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                autocomplete="current-password"
                required
                class="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 py-2 text-sm ring-offset-white transition-all duration-200 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
              >
                <Eye v-if="!showPassword" class="h-5 w-5" />
                <EyeOff v-else class="h-5 w-5" />
              </button>
            </div>
          </div>

          <div class="flex justify-end -mt-1">
            <router-link to="/forgot-password" class="text-xs font-medium text-primary transition-colors hover:text-primary-700">Lupa password?</router-link>
          </div>

          <Button :disabled="busy" type="submit" class="h-11 w-full text-base">
            {{ busy ? 'Sedang masuk...' : 'Masuk' }}
            <ArrowRight v-if="!busy" class="h-4 w-4" />
          </Button>
        </form>

        <p class="mt-8 text-center text-sm text-slate-500">
          Belum punya akun?
          <router-link to="/register" class="font-semibold text-primary underline-offset-4 transition-colors hover:text-primary-700 hover:underline">Buat Akun</router-link>
        </p>
        <!-- <p class="mt-2 text-center text-sm text-slate-500">
          Ingin jadi reseller?
          <router-link to="/register-agency" class="font-semibold text-teal-600 underline-offset-4 transition-colors hover:text-teal-700 hover:underline">Daftar Agency</router-link>
        </p> -->
      </div>
    </div>
  </div>
</template>
