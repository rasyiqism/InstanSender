<script setup>
import { ref } from 'vue'
import api from '../../services/api'
import Button from '../../components/ui/Button.vue'
import Alert from '../../components/ui/Alert.vue'
import { appName } from '../../config'
import {
  Mail,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  MailCheck,
  Zap,
  ShieldCheck,
  BarChart3,
} from 'lucide-vue-next'

const email = ref('')
const error = ref('')
const busy = ref(false)
const sent = ref(false)

const features = [
  { icon: Zap, title: 'Pengiriman super cepat', desc: 'Pesan sampai dalam hitungan detik.' },
  { icon: ShieldCheck, title: 'Aman & andal', desc: 'Enkripsi tingkat enterprise, selalu aktif.' },
  { icon: BarChart3, title: 'Analitik real-time', desc: 'Pantau pembukaan, klik, dan konversi.' },
]

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await api.post('/auth/forgot-password', { email: email.value })
    sent.value = true
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal mengirim tautan reset'
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
          Lupa password?
        </h2>
        <p class="mt-4 text-base leading-relaxed text-primary-50/80">
          Tidak perlu khawatir. Masukkan email Anda dan kami akan mengirimkan
          tautan untuk mengatur ulang password akun Anda.
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

        <!-- Success state -->
        <div v-if="sent" class="text-center">
          <div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary ring-1 ring-primary-100">
            <MailCheck class="h-7 w-7" />
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">Cek email Anda</h1>
          <p class="mt-2 text-sm leading-relaxed text-slate-500">
            Kami telah mengirimkan tautan reset password ke
            <span class="font-semibold text-slate-700">{{ email }}</span>.
            Tautan berlaku selama 30 menit.
          </p>

          <div class="mt-6 rounded-xl bg-slate-50 p-4 text-left">
            <p class="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
              <CheckCircle2 class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Tidak menerima email? Periksa folder spam, atau coba kirim ulang dengan email yang sama.
            </p>
          </div>

          <button
            type="button"
            @click="sent = false"
            class="mx-auto mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-700"
          >
            <ArrowLeft class="h-4 w-4" />
            Coba email lain
          </button>
        </div>

        <!-- Form state -->
        <template v-else>
          <!-- Header -->
          <div class="mb-8">
            <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Lupa password</h1>
            <p class="mt-2 text-sm text-slate-500">Masukkan email Anda untuk menerima tautan reset</p>
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

            <Button :disabled="busy" type="submit" class="h-11 w-full text-base">
              {{ busy ? 'Mengirim...' : 'Kirim Tautan Reset' }}
              <ArrowRight v-if="!busy" class="h-4 w-4" />
            </Button>
          </form>

          <p class="mt-8 text-center text-sm text-slate-500">
            Ingat password Anda?
            <router-link to="/login" class="font-semibold text-primary underline-offset-4 transition-colors hover:text-primary-700 hover:underline">Masuk</router-link>
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
