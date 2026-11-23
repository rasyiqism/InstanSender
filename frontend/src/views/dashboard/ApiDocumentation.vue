<script setup>
import { computed, ref } from 'vue'
import { apiBaseUrl } from '../../config'
import Card from '../../components/ui/Card.vue'
import Badge from '../../components/ui/Badge.vue'
import Alert from '../../components/ui/Alert.vue'
import Button from '../../components/ui/Button.vue'
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Image as ImageIcon,
  KeyRound,
  Send,
  Smartphone,
  Terminal,
} from 'lucide-vue-next'

// Base URL shown across all examples (strip trailing slash for clean output).
const baseUrl = computed(() => apiBaseUrl.replace(/\/+$/, '') || '/api')

const copied = ref('')
async function copy(text, key) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = key
    setTimeout(() => (copied.value = ''), 2000)
  } catch {
    /* clipboard unavailable */
  }
}

// Active language tab for each example block.
const textLang = ref('curl')
const imageLang = ref('curl')
const langs = [
  { value: 'curl', label: 'cURL' },
  { value: 'js', label: 'JavaScript' },
  { value: 'php', label: 'PHP' },
]

const textExamples = computed(() => ({
  curl: `curl -X POST ${baseUrl.value}/v1/messages/send \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "deviceId": "DEVICE_ID",
    "to": "6281234567890",
    "message": "Halo, ini pesan dari API Gateway!"
  }'`,
  js: `const res = await fetch("${baseUrl.value}/v1/messages/send", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_TOKEN",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    deviceId: "DEVICE_ID",
    to: "6281234567890",
    message: "Halo, ini pesan dari API Gateway!",
  }),
});

const data = await res.json();
console.log(data);`,
  php: `<?php
$ch = curl_init("${baseUrl.value}/v1/messages/send");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  "Authorization: Bearer YOUR_API_TOKEN",
  "Content-Type: application/json",
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
  "deviceId" => "DEVICE_ID",
  "to" => "6281234567890",
  "message" => "Halo, ini pesan dari API Gateway!",
]));

$response = curl_exec($ch);
curl_close($ch);
echo $response;`,
}))

const imageExamples = computed(() => ({
  curl: `curl -X POST ${baseUrl.value}/v1/messages/send-media \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -F "deviceId=DEVICE_ID" \\
  -F "to=6281234567890" \\
  -F "caption=Ini caption gambar" \\
  -F "media=@/path/to/image.jpg"`,
  js: `const form = new FormData();
form.append("deviceId", "DEVICE_ID");
form.append("to", "6281234567890");
form.append("caption", "Ini caption gambar");
form.append("media", fileInput.files[0]);

const res = await fetch("${baseUrl.value}/v1/messages/send-media", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_TOKEN",
    // Jangan set Content-Type — biarkan browser atur boundary
  },
  body: form,
});

const data = await res.json();
console.log(data);`,
  php: `<?php
$ch = curl_init("${baseUrl.value}/v1/messages/send-media");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  "Authorization: Bearer YOUR_API_TOKEN",
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, [
  "deviceId" => "DEVICE_ID",
  "to" => "6281234567890",
  "caption" => "Ini caption gambar",
  "media" => new CURLFile("/path/to/image.jpg"),
]);

$response = curl_exec($ch);
curl_close($ch);
echo $response;`,
}))

const successResponse = `{
  "success": true,
  "messageId": "msg_abc123",
  "status": "queued",
  "to": "6281234567890"
}`

const errorResponse = `{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing API token",
  "statusCode": 401
}`

const textParams = [
  { field: 'deviceId', type: 'string', required: true, desc: 'ID device WhatsApp pengirim.' },
  { field: 'to', type: 'string', required: true, desc: 'Nomor tujuan format internasional tanpa "+", contoh: 6281234567890.' },
  { field: 'message', type: 'string', required: true, desc: 'Isi pesan teks. Mendukung emoji & multiline.' },
]

const imageParams = [
  { field: 'deviceId', type: 'string', required: true, desc: 'ID device WhatsApp pengirim.' },
  { field: 'to', type: 'string', required: true, desc: 'Nomor tujuan format internasional tanpa "+", contoh: 6281234567890.' },
  { field: 'media', type: 'file', required: true, desc: 'File gambar (multipart). Format: jpg, png, webp.' },
  { field: 'caption', type: 'string', required: false, desc: 'Caption teks yang menyertai gambar.' },
]

const sections = [
  { id: 'auth', label: 'Authentication', icon: KeyRound },
  { id: 'send-text', label: 'Send Text Message', icon: Send },
  { id: 'send-image', label: 'Send Image', icon: ImageIcon },
  { id: 'response', label: 'Responses', icon: Code2 },
]
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <div class="flex items-center gap-2.5">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
          <BookOpen class="h-5 w-5" />
        </div>
        <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
          API Documentation
        </h2>
      </div>
      <p class="mt-1.5 text-sm text-slate-500">
        Panduan integrasi WhatsApp Gateway — kirim pesan teks & gambar via REST API.
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[200px_1fr]">
      <!-- Sidebar nav -->
      <nav class="hidden lg:block">
        <p class="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Daftar Isi</p>
        <a
          v-for="s in sections"
          :key="s.id"
          :href="`#${s.id}`"
          class="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <component :is="s.icon" class="h-4 w-4 text-slate-400 group-hover:text-primary" />
          {{ s.label }}
        </a>
      </nav>

      <div class="min-w-0 space-y-6">
        <!-- Base URL -->
        <Card class="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <Terminal class="h-5 w-5" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900">Base URL</h3>
              <p class="mt-0.5 text-xs text-slate-500">Semua endpoint diawali dengan URL ini.</p>
            </div>
          </div>
          <div class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <code class="min-w-0 flex-1 truncate font-mono text-xs text-slate-700 sm:text-sm">{{ baseUrl }}</code>
            <button
              type="button"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
              @click="copy(baseUrl, 'base')"
            >
              <Check v-if="copied === 'base'" class="h-3.5 w-3.5 text-primary" />
              <Copy v-else class="h-3.5 w-3.5" />
            </button>
          </div>
        </Card>

        <!-- Authentication -->
        <Card id="auth" class="overflow-hidden p-0 scroll-mt-24">
          <div class="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <KeyRound class="h-5 w-5 text-primary" />
            <h3 class="text-base font-bold text-slate-900">Authentication</h3>
          </div>
          <div class="space-y-3 p-5 text-sm leading-relaxed text-slate-600">
            <p>
              API menggunakan <strong>Bearer Token</strong>. Buat API Key di halaman
              <router-link to="/api-keys" class="font-semibold text-primary hover:underline">API Keys</router-link>,
              lalu kirim token pada header <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-primary">Authorization</code> untuk setiap request.
            </p>
            <div class="rounded-xl bg-slate-950 p-4">
              <pre class="font-mono text-xs leading-relaxed text-slate-200">Authorization: Bearer YOUR_API_TOKEN</pre>
            </div>
            <Alert variant="warning" class="text-sm">
              <strong>Penting:</strong> Jaga kerahasiaan API token. Jangan commit ke repository publik atau hardcode di client-side.
            </Alert>
          </div>
        </Card>

        <!-- Send Text Message -->
        <Card id="send-text" class="overflow-hidden p-0 scroll-mt-24">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div class="flex items-center gap-3">
              <Send class="h-5 w-5 text-primary" />
              <h3 class="text-base font-bold text-slate-900">Send Text Message</h3>
            </div>
            <Badge variant="success">POST</Badge>
          </div>
          <div class="space-y-4 p-5">
            <p class="text-sm leading-relaxed text-slate-600">
              Kirim pesan teks WhatsApp ke nomor tujuan. Endpoint:
              <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-primary">/v1/messages/send</code>
            </p>

            <!-- Parameters -->
            <div>
              <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Parameters</h4>
              <div class="overflow-hidden rounded-xl border border-slate-200">
                <table class="w-full text-left text-sm">
                  <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th class="px-4 py-2.5 font-semibold">Field</th>
                      <th class="px-4 py-2.5 font-semibold">Type</th>
                      <th class="px-4 py-2.5 font-semibold">Required</th>
                      <th class="px-4 py-2.5 font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-for="p in textParams" :key="p.field" class="text-slate-600">
                      <td class="px-4 py-2.5 font-mono text-xs font-semibold text-slate-900">{{ p.field }}</td>
                      <td class="px-4 py-2.5 text-xs text-slate-500">{{ p.type }}</td>
                      <td class="px-4 py-2.5">
                        <Badge v-if="p.required" variant="success">Yes</Badge>
                        <Badge v-else variant="secondary">No</Badge>
                      </td>
                      <td class="px-4 py-2.5 text-xs">{{ p.desc }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Example with tabs -->
            <div>
              <div class="mb-2 flex items-center justify-between">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Example Request</h4>
                <div class="flex gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    v-for="l in langs"
                    :key="l.value"
                    type="button"
                    class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                    :class="textLang === l.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
                    @click="textLang = l.value"
                  >
                    {{ l.label }}
                  </button>
                </div>
              </div>
              <div class="relative overflow-hidden rounded-xl bg-slate-950">
                <button
                  type="button"
                  class="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                  @click="copy(textExamples[textLang], 'text-' + textLang)"
                >
                  <Check v-if="copied === 'text-' + textLang" class="h-3.5 w-3.5 text-primary" />
                  <Copy v-else class="h-3.5 w-3.5" />
                </button>
                <pre class="overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200"><code>{{ textExamples[textLang] }}</code></pre>
              </div>
            </div>
          </div>
        </Card>

        <!-- Send Image -->
        <Card id="send-image" class="overflow-hidden p-0 scroll-mt-24">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div class="flex items-center gap-3">
              <ImageIcon class="h-5 w-5 text-primary" />
              <h3 class="text-base font-bold text-slate-900">Send Image</h3>
            </div>
            <Badge variant="success">POST</Badge>
          </div>
          <div class="space-y-4 p-5">
            <p class="text-sm leading-relaxed text-slate-600">
              Kirim gambar dengan caption ke nomor tujuan. Endpoint:
              <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-primary">/v1/messages/send-media</code>
              <span class="ml-1 text-xs text-slate-400">(multipart/form-data)</span>
            </p>

            <!-- Parameters -->
            <div>
              <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Parameters</h4>
              <div class="overflow-hidden rounded-xl border border-slate-200">
                <table class="w-full text-left text-sm">
                  <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th class="px-4 py-2.5 font-semibold">Field</th>
                      <th class="px-4 py-2.5 font-semibold">Type</th>
                      <th class="px-4 py-2.5 font-semibold">Required</th>
                      <th class="px-4 py-2.5 font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-for="p in imageParams" :key="p.field" class="text-slate-600">
                      <td class="px-4 py-2.5 font-mono text-xs font-semibold text-slate-900">{{ p.field }}</td>
                      <td class="px-4 py-2.5 text-xs text-slate-500">{{ p.type }}</td>
                      <td class="px-4 py-2.5">
                        <Badge v-if="p.required" variant="success">Yes</Badge>
                        <Badge v-else variant="secondary">No</Badge>
                      </td>
                      <td class="px-4 py-2.5 text-xs">{{ p.desc }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Example with tabs -->
            <div>
              <div class="mb-2 flex items-center justify-between">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Example Request</h4>
                <div class="flex gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    v-for="l in langs"
                    :key="l.value"
                    type="button"
                    class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                    :class="imageLang === l.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
                    @click="imageLang = l.value"
                  >
                    {{ l.label }}
                  </button>
                </div>
              </div>
              <div class="relative overflow-hidden rounded-xl bg-slate-950">
                <button
                  type="button"
                  class="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                  @click="copy(imageExamples[imageLang], 'image-' + imageLang)"
                >
                  <Check v-if="copied === 'image-' + imageLang" class="h-3.5 w-3.5 text-primary" />
                  <Copy v-else class="h-3.5 w-3.5" />
                </button>
                <pre class="overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200"><code>{{ imageExamples[imageLang] }}</code></pre>
              </div>
            </div>
          </div>
        </Card>

        <!-- Responses -->
        <Card id="response" class="overflow-hidden p-0 scroll-mt-24">
          <div class="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <Code2 class="h-5 w-5 text-primary" />
            <h3 class="text-base font-bold text-slate-900">Responses</h3>
          </div>
          <div class="space-y-4 p-5">
            <!-- Success -->
            <div>
              <div class="mb-2 flex items-center gap-2">
                <Badge variant="success">200 OK</Badge>
                <span class="text-sm font-medium text-slate-700">Success</span>
              </div>
              <div class="overflow-hidden rounded-xl bg-slate-950">
                <pre class="overflow-auto p-4 font-mono text-xs leading-relaxed text-emerald-300"><code>{{ successResponse }}</code></pre>
              </div>
            </div>
            <!-- Error -->
            <div>
              <div class="mb-2 flex items-center gap-2">
                <Badge variant="destructive">401</Badge>
                <span class="text-sm font-medium text-slate-700">Unauthorized</span>
              </div>
              <div class="overflow-hidden rounded-xl bg-slate-950">
                <pre class="overflow-auto p-4 font-mono text-xs leading-relaxed text-red-300"><code>{{ errorResponse }}</code></pre>
              </div>
            </div>

            <!-- Status codes table -->
            <div>
              <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Status Codes</h4>
              <div class="overflow-hidden rounded-xl border border-slate-200">
                <table class="w-full text-left text-sm">
                  <tbody class="divide-y divide-slate-100 text-slate-600">
                    <tr><td class="px-4 py-2.5"><Badge variant="success">200</Badge></td><td class="px-4 py-2.5 text-xs">Pesan berhasil diantrikan untuk dikirim.</td></tr>
                    <tr><td class="px-4 py-2.5"><Badge variant="destructive">401</Badge></td><td class="px-4 py-2.5 text-xs">Token tidak valid atau hilang.</td></tr>
                    <tr><td class="px-4 py-2.5"><Badge variant="warning">422</Badge></td><td class="px-4 py-2.5 text-xs">Validasi gagal — field tidak lengkap / format salah.</td></tr>
                    <tr><td class="px-4 py-2.5"><Badge variant="destructive">500</Badge></td><td class="px-4 py-2.5 text-xs">Kesalahan server. Coba lagi nanti.</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
