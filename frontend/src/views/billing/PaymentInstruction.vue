<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useBillingStore } from '../../stores/billing'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Alert from '../../components/ui/Alert.vue'
import Badge from '../../components/ui/Badge.vue'
import { Banknote, Upload, CheckCircle2, ArrowLeft, Loader2, Building2, FileUp } from 'lucide-vue-next'

const route = useRoute()
const store = useBillingStore()
const order = ref(null)

const BANK_LOGOS = {
  BCA: 'https://framerusercontent.com/images/59NDCntV301wtJsL4xOrKpwlUv8.png',
  BRI: 'https://framerusercontent.com/images/oVjhWlaHjgJdS1vgjlCVUzqVfjk.png',
}

function bankLogo(bankName) {
  return BANK_LOGOS[String(bankName || '').toUpperCase()] ?? null
}
const transferInstruction = computed(() => {
  if (!order.value) return null

  if (order.value.transferInstruction) {
    return order.value.transferInstruction
  }

  const note = order.value.note ?? (
    order.value.kodeUnik
      ? `Transfer tepat sebesar nominal di atas (termasuk kode unik ${order.value.kodeUnik}) agar verifikasi cepat.`
      : 'Transfer tepat sebesar nominal di atas.'
  )

  return {
    bankAccount: order.value.bankAccountTujuan ?? order.value.bankAccount ?? '',
    bankAccounts: [],
    amount: order.value.amount ?? 0,
    note,
  }
})
const bankAccounts = computed(() => {
  const accounts = transferInstruction.value?.bankAccounts
  if (Array.isArray(accounts) && accounts.length) return accounts

  const fallback = transferInstruction.value?.bankAccount
  if (!fallback) return []
  return [{
    bankName: 'Bank Transfer',
    accountNumber: fallback,
    accountHolder: '',
    label: 'Transfer'
  }]
})
const file = ref(null)
const uploading = ref(false)
const uploadMsg = ref('')
const uploadSuccess = ref(false)

onMounted(async () => {
  await store.fetchPayments()
  order.value = store.payments.find((p) => p.id === route.params.orderId) || null
})

async function uploadProof() {
  if (!file.value || !order.value?.id) return
  uploading.value = true
  uploadMsg.value = ''
  uploadSuccess.value = false
  try {
    await store.uploadProof(order.value.id, file.value)
    uploadMsg.value = 'Payment proof uploaded successfully. Admin will verify your payment shortly.'
    uploadSuccess.value = true
  } catch (err) {
    uploadMsg.value = err.response?.data?.message ?? 'Upload failed'
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg space-y-6">
    <!-- Back Link -->
    <router-link to="/billing" class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
      <ArrowLeft class="h-4 w-4" />
      Back to packages
    </router-link>

    <div v-if="!order" class="flex items-center justify-center py-12">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
      <span class="ml-2 text-sm text-slate-500">Loading order details...</span>
    </div>

    <div v-else class="space-y-6">
      <!-- Header -->
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">Payment Instruction</h2>
        <p class="mt-1.5 text-sm text-slate-500">Complete the transfer and upload your proof of payment.</p>
      </div>

      <!-- Transfer Details -->
      <Card class="overflow-hidden p-0">
        <div class="border-b border-slate-100 bg-linear-to-r from-primary-50 to-white p-5">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary">
              <Building2 class="h-5 w-5" />
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wider text-slate-500">Bank Transfer</p>
              <p class="text-lg font-bold text-slate-900">BCA / BRI</p>
            </div>
          </div>
        </div>

        <div v-if="transferInstruction" class="p-5 space-y-4">
          <div class="overflow-hidden rounded-xl border border-slate-100">
            <div
              v-for="account in bankAccounts"
              :key="`${account.bankName}-${account.accountNumber}`"
              class="flex items-center justify-between gap-4 border-b border-slate-100 p-4 last:border-b-0"
            >
              <div class="min-w-0">
                <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {{ account.label || account.bankName }}
                </p>
                <p class="mt-1 break-all text-lg font-bold text-slate-900">
                  {{ account.accountNumber }}
                </p>
                <p v-if="account.accountHolder" class="mt-0.5 text-sm text-slate-500">
                  a.n. {{ account.accountHolder }}
                </p>
              </div>
              <img
                v-if="bankLogo(account.bankName)"
                :src="bankLogo(account.bankName)"
                :alt="account.bankName"
                class="h-8 w-auto shrink-0 rounded object-contain"
              >
              <Badge v-else variant="secondary" class="shrink-0">{{ account.bankName }}</Badge>
            </div>
          </div>

          <div class="rounded-2xl bg-primary-50 p-5 text-center">
            <p class="text-xs font-medium uppercase tracking-wider text-primary-600">Total Payment</p>
            <p class="mt-1 text-4xl font-extrabold tracking-tight text-primary-700">
              Rp {{ Number(transferInstruction.amount).toLocaleString() }}
            </p>
          </div>

          <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div class="flex gap-2 text-sm text-slate-600">
              <Banknote class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{{ transferInstruction.note }}</span>
            </div>
          </div>

          <div class="flex items-center gap-2 text-xs text-slate-400">
            <Badge variant="secondary">Status: {{ order.status }}</Badge>
            <span>After upload, admin will verify and activate your subscription.</span>
          </div>
        </div>

        <div v-else class="p-5 text-sm text-slate-500">
          Transfer instruction is not available for this order yet.
        </div>
      </Card>

      <!-- Upload Proof -->
      <Card class="p-6">
        <h3 class="mb-1 text-lg font-bold tracking-tight text-slate-900">Upload Proof</h3>
        <p class="mb-5 text-sm text-slate-500">Upload a screenshot or PDF of your bank transfer confirmation.</p>

        <div class="space-y-4">
          <!-- File Input Area -->
          <label
            class="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 transition-all duration-200 hover:border-primary-300 hover:bg-primary-50/50"
          >
            <FileUp class="mb-2 h-8 w-8 text-slate-400" />
            <span class="text-sm font-medium text-slate-600">
              {{ file ? file.name : 'Click to select file' }}
            </span>
            <span class="mt-1 text-xs text-slate-400">Supports images &amp; PDF</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              class="hidden"
              @change="e => { file = e.target.files[0]; uploadMsg.value = ''; uploadSuccess = false }"
            />
          </label>

          <Button
            @click="uploadProof"
            :disabled="!file || uploading"
            class="w-full gap-2"
          >
            <Loader2 v-if="uploading" class="h-4 w-4 animate-spin" />
            <Upload v-else class="h-4 w-4" />
            {{ uploading ? 'Uploading...' : 'Upload Proof' }}
          </Button>

          <Alert v-if="uploadMsg" :variant="uploadSuccess ? 'success' : 'destructive'" class="text-sm">
            <template #icon>
              <CheckCircle2 v-if="uploadSuccess" class="h-4 w-4" />
            </template>
            {{ uploadMsg }}
          </Alert>
        </div>
      </Card>
    </div>
  </div>
</template>
