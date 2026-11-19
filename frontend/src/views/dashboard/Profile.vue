<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import Card from '../../components/ui/Card.vue'
import Button from '../../components/ui/Button.vue'
import Alert from '../../components/ui/Alert.vue'
import Modal from '../../components/ui/Modal.vue'
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Save,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-vue-next'

const auth = useAuthStore()

// Shared result modal for success/failure feedback
const result = ref({ open: false, variant: 'success', icon: CheckCircle2, title: '', message: '' })

function showResult(variant, title, message) {
  result.value = {
    open: true,
    variant,
    icon: variant === 'success' ? CheckCircle2 : XCircle,
    title,
    message,
  }
}

function closeResult() {
  result.value.open = false
}

const initials = computed(() => {
  // Prefer initials from the display name; fall back to the email's local part.
  const source = (auth.user?.name ?? '').trim() || (auth.user?.email ?? '').split('@')[0]
  if (!source) return '?'
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
})

// ---- Profile form ----
const profile = reactive({
  name: '',
  email: '',
  phoneNumber: '',
})
const profileError = ref('')
const profileBusy = ref(false)

// ---- Password form ----
const password = reactive({
  current: '',
  next: '',
  confirm: '',
})
const passwordError = ref('')
const passwordBusy = ref(false)
const showCurrent = ref(false)
const showNext = ref(false)

const passwordMismatch = computed(
  () => password.confirm.length > 0 && password.next !== password.confirm
)

onMounted(() => {
  profile.name = auth.user?.name ?? ''
  profile.email = auth.user?.email ?? ''
  profile.phoneNumber = auth.user?.phoneNumber ?? auth.user?.phone ?? ''
})

async function saveProfile() {
  profileError.value = ''
  profileBusy.value = true
  try {
    await auth.updateProfile({
      name: profile.name,
      email: profile.email,
      phoneNumber: (profile.phoneNumber ?? '').replace(/\+/g, '').trim(),
    })
    showResult('success', 'Profil Diperbarui', 'Informasi profil Anda berhasil disimpan.')
  } catch (err) {
    showResult('destructive', 'Gagal Memperbarui', err.response?.data?.message ?? 'Gagal memperbarui profil')
  } finally {
    profileBusy.value = false
  }
}

async function savePassword() {
  passwordError.value = ''
  if (password.next !== password.confirm) {
    passwordError.value = 'Konfirmasi kata sandi tidak cocok'
    return
  }
  if (password.next.length < 8) {
    passwordError.value = 'Kata sandi baru minimal 8 karakter'
    return
  }
  passwordBusy.value = true
  try {
    await auth.updatePassword({
      currentPassword: password.current,
      newPassword: password.next,
    })
    password.current = ''
    password.next = ''
    password.confirm = ''
    showResult('success', 'Kata Sandi Diubah', 'Kata sandi Anda berhasil diperbarui.')
  } catch (err) {
    showResult('destructive', 'Gagal Mengubah', err.response?.data?.message ?? 'Gagal mengubah kata sandi')
  } finally {
    passwordBusy.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Profil</h2>
      <p class="mt-1.5 text-sm text-slate-500">Kelola informasi akun dan kata sandi Anda.</p>
    </div>

    <!-- Profile card -->
    <Card class="overflow-hidden">
      <div class="border-b border-slate-100 p-6">
        <div class="flex items-center gap-4">
          <div
            class="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary-500 to-primary-700 text-lg font-bold text-white shadow-sm shadow-primary-200"
          >
            {{ initials }}
          </div>
          <div>
            <h3 class="text-lg font-bold tracking-tight text-slate-900">Informasi Profil</h3>
            <p class="text-sm text-slate-500">Perbarui nama, email, dan nomor telepon Anda.</p>
          </div>
        </div>
      </div>

      <form @submit.prevent="saveProfile" class="space-y-5 p-6">
        <Alert v-if="profileError" variant="destructive" class="text-sm">{{ profileError }}</Alert>

        <div class="space-y-2.5">
          <label for="name" class="text-sm font-medium text-slate-700">Nama</label>
          <div class="relative">
            <User class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="name"
              v-model="profile.name"
              type="text"
              placeholder="Nama Anda"
              autocomplete="name"
              required
              class="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 py-2 text-sm ring-offset-white transition-all duration-200 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary"
            />
          </div>
        </div>

        <div class="space-y-2.5">
          <label for="email" class="text-sm font-medium text-slate-700">Email</label>
          <div class="relative">
            <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              v-model="profile.email"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
              required
              class="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 py-2 text-sm ring-offset-white transition-all duration-200 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary"
            />
          </div>
        </div>

        <div class="space-y-2.5">
          <label for="phoneNumber" class="text-sm font-medium text-slate-700">Nomor Telepon</label>
          <div class="relative">
            <Phone class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="phoneNumber"
              v-model="profile.phoneNumber"
              type="tel"
              placeholder="62 812 3456 7890"
              autocomplete="tel"
              class="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 py-2 text-sm ring-offset-white transition-all duration-200 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary"
            />
          </div>
        </div>

        <div class="flex justify-end pt-1">
          <Button :disabled="profileBusy" type="submit" class="h-11">
            <Save v-if="!profileBusy" class="h-4 w-4" />
            {{ profileBusy ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </Button>
        </div>
      </form>
    </Card>

    <!-- Password card -->
    <Card class="overflow-hidden">
      <div class="border-b border-slate-100 p-6">
        <div class="flex items-center gap-4">
          <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary ring-1 ring-primary-100">
            <ShieldCheck class="h-6 w-6" />
          </div>
          <div>
            <h3 class="text-lg font-bold tracking-tight text-slate-900">Keamanan</h3>
            <p class="text-sm text-slate-500">Ubah kata sandi Anda secara berkala untuk menjaga keamanan akun.</p>
          </div>
        </div>
      </div>

      <form @submit.prevent="savePassword" class="space-y-5 p-6">
        <Alert v-if="passwordError" variant="destructive" class="text-sm">{{ passwordError }}</Alert>

        <div class="space-y-2.5">
          <label for="current" class="text-sm font-medium text-slate-700">Kata Sandi Saat Ini</label>
          <div class="relative">
            <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="current"
              v-model="password.current"
              :type="showCurrent ? 'text' : 'password'"
              placeholder="••••••••"
              autocomplete="current-password"
              required
              class="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 py-2 text-sm ring-offset-white transition-all duration-200 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary"
            />
            <button
              type="button"
              @click="showCurrent = !showCurrent"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              :aria-label="showCurrent ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'"
            >
              <Eye v-if="!showCurrent" class="h-5 w-5" />
              <EyeOff v-else class="h-5 w-5" />
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div class="space-y-2.5">
            <label for="next" class="text-sm font-medium text-slate-700">Kata Sandi Baru</label>
            <div class="relative">
              <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="next"
                v-model="password.next"
                :type="showNext ? 'text' : 'password'"
                placeholder="Minimal 8 karakter"
                autocomplete="new-password"
                required
                minlength="8"
                class="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 py-2 text-sm ring-offset-white transition-all duration-200 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary"
              />
              <button
                type="button"
                @click="showNext = !showNext"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                :aria-label="showNext ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'"
              >
                <Eye v-if="!showNext" class="h-5 w-5" />
                <EyeOff v-else class="h-5 w-5" />
              </button>
            </div>
          </div>

          <div class="space-y-2.5">
            <label for="confirm" class="text-sm font-medium text-slate-700">Konfirmasi Kata Sandi</label>
            <div class="relative">
              <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="confirm"
                v-model="password.confirm"
                :type="showNext ? 'text' : 'password'"
                placeholder="Ulangi kata sandi baru"
                autocomplete="new-password"
                required
                class="flex h-11 w-full rounded-xl border bg-white pl-11 pr-3 py-2 text-sm ring-offset-white transition-all duration-200 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary"
                :class="passwordMismatch ? 'border-red-300' : 'border-slate-200'"
              />
            </div>
            <p v-if="passwordMismatch" class="text-xs text-red-500">Konfirmasi kata sandi tidak cocok</p>
          </div>
        </div>

        <div class="flex justify-end pt-1">
          <Button :disabled="passwordBusy" type="submit" class="h-11">
            <ArrowRight v-if="!passwordBusy" class="h-4 w-4" />
            {{ passwordBusy ? 'Menyimpan...' : 'Ubah Kata Sandi' }}
          </Button>
        </div>
      </form>
    </Card>

    <!-- Success / failure result modal -->
    <Modal
      :open="result.open"
      :title="result.title"
      :variant="result.variant"
      :icon="result.icon"
      @close="closeResult"
    >
      <p class="text-sm leading-relaxed text-slate-500">{{ result.message }}</p>
    </Modal>
  </div>
</template>
