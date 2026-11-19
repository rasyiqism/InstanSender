<script setup>
import { useRouter } from 'vue-router'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import { ArrowRight, Boxes, FileSpreadsheet, FormInput } from 'lucide-vue-next'

const router = useRouter()

const integrations = [
  {
    to: 'integrationGoogleForm',
    title: 'Google Form',
    desc: 'Otomatis kirim pesan WhatsApp setiap kali form Google Form di-submit.',
    icon: FormInput,
    accent: 'from-violet-500 to-violet-700',
    tag: 'Form',
  },
  {
    to: 'integrationGoogleSpreadsheet',
    title: 'Google Spreadsheet',
    desc: 'Kirim pesan WhatsApp langsung dari baris Google Spreadsheet lewat Apps Script.',
    icon: FileSpreadsheet,
    accent: 'from-emerald-500 to-emerald-700',
    tag: 'Spreadsheet',
  },
]
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
        Integrations
      </h2>
      <p class="mt-1.5 text-sm text-slate-500">
        Hubungkan layanan eksternal dengan WhatsApp Gateway. Pilih integrasi untuk membuat script-nya.
      </p>
    </div>

    <!-- Integration grid -->
    <div class="grid gap-4 sm:grid-cols-2">
      <Card
        v-for="item in integrations"
        :key="item.to"
        class="group cursor-pointer overflow-hidden p-0 transition-all duration-200 hover:shadow-lg"
        @click="router.push({ name: item.to })"
      >
        <div class="p-5">
          <div class="flex items-start justify-between">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-sm"
              :class="item.accent"
            >
              <component :is="item.icon" class="h-6 w-6" />
            </div>
            <Badge variant="secondary">{{ item.tag }}</Badge>
          </div>
          <h3 class="mt-4 text-lg font-bold tracking-tight text-slate-900">
            {{ item.title }}
          </h3>
          <p class="mt-1 text-sm leading-relaxed text-slate-500">
            {{ item.desc }}
          </p>
        </div>
        <div class="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <span class="text-xs font-medium text-slate-400">Buat script integrasi</span>
          <span class="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-transform duration-200 group-hover:translate-x-0.5">
            Buka
            <ArrowRight class="h-4 w-4" />
          </span>
        </div>
      </Card>
    </div>

    <!-- Info card -->
    <Card class="flex items-start gap-4 p-5">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
        <Boxes class="h-5 w-5" />
      </div>
      <div>
        <h3 class="text-sm font-bold text-slate-900">Cara kerja integrasi</h3>
        <p class="mt-1 text-sm leading-relaxed text-slate-500">
          Setiap integrasi menghasilkan script siap pakai (Google Apps Script) yang memanggil API Gateway.
          Cukup tempel ke editor Apps Script, isi token, lalu jalankan. Tidak perlu server tambahan.
        </p>
      </div>
    </Card>
  </div>
</template>
