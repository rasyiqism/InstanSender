<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBillingStore } from '../../stores/billing'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Alert from '../../components/ui/Alert.vue'
import { Crown, Check, Loader2, Smartphone, Send, Clock, Gauge, Sparkles } from 'lucide-vue-next'

const router = useRouter()
const store = useBillingStore()
const busy = ref(false)
const error = ref('')
const loading = computed(() => store.packages.length === 0 && !error.value)

onMounted(async () => {
  await Promise.all([store.fetchPackages(), store.fetchSubscription()])
})

async function select(packageId) {
  busy.value = true
  error.value = ''
  try {
    const order = await store.createOrder(packageId)
    router.push(`/billing/payment/${order.orderId}`)
  } catch (err) {
    error.value = err.response?.data?.message ?? 'Failed to create order'
  } finally {
    busy.value = false
  }
}

const features = {
  maxDevice: (pkg) => ({
    icon: Smartphone,
    label: `${pkg.maxDevice} device${pkg.maxDevice > 1 ? 's' : ''}`,
  }),
  messageQuota: (pkg) => ({
    icon: Send,
    label: pkg.messageQuota ? `${pkg.messageQuota.toLocaleString()} messages` : 'Unlimited messages',
  }),
  durationDays: (pkg) => ({
    icon: Clock,
    label: `${pkg.durationDays} days duration`,
  }),
  rateLimitPerSecond: (pkg) => ({
    icon: Gauge,
    label: `${pkg.rateLimitPerSecond} req/s API rate`,
  }),
}

// Auto-mark the middle package as "recommended" when no explicit flag exists.
const recommendedIndex = computed(() => {
  const list = store.packages
  if (!list.length) return -1
  const explicit = list.findIndex((p) => p.recommended || p.popular)
  return explicit >= 0 ? explicit : Math.floor(list.length / 2)
})

function formatPrice(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value ?? 0))
}
</script>

<template>
  <div class="space-y-6">
    <!-- Error -->
    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <!-- Busy overlay -->
    <div v-if="busy" class="flex items-center gap-2 text-sm text-slate-500">
      <Loader2 class="h-4 w-4 animate-spin" /> Memproses pesanan...
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="grid grid-cols-1 gap-6 md:grid-cols-3">
      <Card v-for="i in 3" :key="i" class="overflow-hidden p-0">
        <div class="animate-pulse">
          <div class="bg-slate-100 p-6 pb-8">
            <div class="h-6 w-24 rounded bg-slate-200"></div>
            <div class="mt-3 h-9 w-32 rounded bg-slate-200"></div>
          </div>
          <div class="space-y-3 p-6 pt-4">
            <div v-for="j in 4" :key="j" class="h-4 rounded bg-slate-100" :style="{ width: 70 + (j * 5) + '%' }"></div>
            <div class="mt-6 h-10 rounded-xl bg-slate-200"></div>
          </div>
        </div>
      </Card>
    </div>

    <!-- Package Cards -->
    <div v-else class="grid grid-cols-1 gap-6 md:grid-cols-3">
      <Card
        v-for="(pkg, index) in store.packages"
        :key="pkg.id"
        class="group relative flex flex-col overflow-hidden p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary-100/50"
        :class="[
          store.subscription?.packageId === pkg.id ? 'ring-2 ring-primary ring-offset-2' : '',
          index === recommendedIndex ? 'border-primary/40 shadow-md' : '',
        ]"
      >
        <!-- Recommended ribbon -->
        <div v-if="index === recommendedIndex && store.subscription?.packageId !== pkg.id" class="absolute right-0 top-0">
          <div class="bg-linear-to-r from-primary-500 to-primary-700 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            <span class="inline-flex items-center gap-1">
              <Sparkles class="h-3 w-3" /> Recommended
            </span>
          </div>
        </div>

        <!-- Current badge -->
        <div v-if="store.subscription?.packageId === pkg.id" class="absolute right-0 top-0">
          <div class="flex items-center gap-1 bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            <Crown class="h-3 w-3" /> Current
          </div>
        </div>

        <!-- Header -->
        <div class="relative bg-linear-to-br from-primary-50 to-white p-6 pb-7">
          <h3 class="text-xl font-extrabold tracking-tight text-slate-900">{{ pkg.name }}</h3>
          <div class="mt-3 flex items-baseline gap-1.5">
            <span class="text-3xl font-extrabold tracking-tight text-primary-700">Rp{{ formatPrice(pkg.price) }}</span>
            <span class="text-xs font-medium text-slate-400">/ {{ pkg.durationDays }} hari</span>
          </div>
        </div>

        <!-- Features -->
        <div class="flex flex-1 flex-col p-6 pt-5">
          <ul class="flex-1 space-y-0">
            <li
              v-for="(getFeature, key) in features"
              :key="key"
              class="flex items-center gap-3 border-b border-slate-100 py-3 text-sm text-slate-600 last:border-0"
            >
              <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
                <component :is="getFeature(pkg).icon" class="h-3.5 w-3.5" />
              </div>
              {{ getFeature(pkg).label }}
              <Check class="ml-auto h-4 w-4 shrink-0 text-primary" />
            </li>
          </ul>

          <!-- CTA -->
          <Button
            class="mt-6 w-full"
            :variant="store.subscription?.packageId === pkg.id ? 'outline' : 'default'"
            :disabled="busy"
            @click="select(pkg.id)"
          >
            <Crown v-if="store.subscription?.packageId === pkg.id" class="h-4 w-4" />
            {{ store.subscription?.packageId === pkg.id ? 'Perpanjang Paket' : 'Pilih Paket' }}
          </Button>
        </div>
      </Card>
    </div>
  </div>
</template>
