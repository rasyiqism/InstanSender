<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../services/api'
import { useAgencyStore } from '../../stores/agency'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Alert from '../../components/ui/Alert.vue'
import { ArrowLeft, Eye, EyeOff, Loader2, Smartphone } from 'lucide-vue-next'

const router = useRouter()
const store = useAgencyStore()

const packages = ref([])
const error = ref('')
const busy = ref(false)
const showPassword = ref(false)

const form = reactive({
  name: '',
  email: '',
  phone: '',
  password: '',
  packageId: '',
})

onMounted(async () => {
  try {
    const { data } = await api.get('/user-packages')
    packages.value = data
    if (packages.value.length) form.packageId = packages.value[0].id
  } catch {
    error.value = 'Gagal memuat user packages'
  }
})

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const phoneNumber = (form.phone ?? '').replace(/\+/g, '').trim()
    await store.createUser({
      name: form.name,
      email: form.email,
      password: form.password,
      phoneNumber: phoneNumber || undefined,
      packageId: form.packageId,
    })
    router.push('/agency/users')
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Gagal membuat user'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" @click="router.push('/agency/users')">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">Create User</h2>
        <p class="mt-1 text-sm text-slate-500">Buat user baru di bawah agency Anda.</p>
      </div>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <Card class="p-6">
      <form class="space-y-4" @submit.prevent="submit">
        <label class="block space-y-1.5">
          <span class="text-sm font-medium text-slate-700">Nama</span>
          <input v-model="form.name" type="text" required placeholder="Ahmad Store" class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </label>

        <label class="block space-y-1.5">
          <span class="text-sm font-medium text-slate-700">Email</span>
          <input v-model="form.email" type="email" required placeholder="ahmad@gmail.com" class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </label>

        <label class="block space-y-1.5">
          <span class="text-sm font-medium text-slate-700">Nomor WhatsApp</span>
          <input v-model="form.phone" type="tel" placeholder="628123456789" class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </label>

        <div class="block space-y-1.5">
          <span class="text-sm font-medium text-slate-700">Password</span>
          <div class="relative">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              required
              minlength="8"
              placeholder="Minimal 8 karakter"
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pr-11 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
              @click="showPassword = !showPassword"
            >
              <Eye v-if="!showPassword" class="h-5 w-5" />
              <EyeOff v-else class="h-5 w-5" />
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <span class="text-sm font-medium text-slate-700">Pilih Package</span>
          <div v-if="!packages.length" class="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 class="h-4 w-4 animate-spin" /> Memuat packages...
          </div>
          <div v-else class="space-y-2">
            <label
              v-for="pkg in packages"
              :key="pkg.id"
              :class="[
                'flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all',
                form.packageId === pkg.id
                  ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-500/20'
                  : 'border-slate-200 hover:border-slate-300',
              ]"
            >
              <div class="flex items-center gap-3">
                <input v-model="form.packageId" :value="pkg.id" type="radio" class="h-4 w-4 text-teal-600" />
                <div>
                  <p class="font-medium text-slate-900">{{ pkg.name }}</p>
                  <p class="text-xs text-slate-500">{{ pkg.maxDevice }} device · {{ pkg.durationDays }} hari</p>
                </div>
              </div>
              <div class="flex items-center gap-1 text-xs text-slate-400">
                <Smartphone class="h-3.5 w-3.5" />
                {{ pkg.maxDevice }}
              </div>
            </label>
          </div>
        </div>

        <div class="pt-2">
          <Button type="submit" :disabled="busy || !form.packageId" class="h-11 w-full">
            <Loader2 v-if="busy" class="h-4 w-4 animate-spin" />
            Create User
          </Button>
        </div>
      </form>
    </Card>
  </div>
</template>
