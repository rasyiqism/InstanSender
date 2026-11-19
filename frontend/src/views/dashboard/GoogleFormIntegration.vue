<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useScriptGenerator } from '../../composables/useScriptGenerator'
import Button from '../../components/ui/Button.vue'
import Card from '../../components/ui/Card.vue'
import Alert from '../../components/ui/Alert.vue'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FormInput,
  Info,
  Phone,
  KeyRound,
  Smartphone,
} from 'lucide-vue-next'

const router = useRouter()
const { token, copied, messagesEndpoint, devices, deviceId, copyScript, downloadScript } = useScriptGenerator()

const form = reactive({
  // Map of Google Form field names → placeholder variables used in the script.
  phoneField: 'Phone',
  messageField: 'Message',
})

const error = ref('')

/**
 * Build a Google Apps Script that listens to Google Form submissions and
 * sends a WhatsApp message via the Gateway API for each response.
 */
const script = computed(() => {
  const phone = form.phoneField.trim() || 'Phone'
  const message = form.messageField.trim() || 'Message'

  return `/**
 * Google Form → WhatsApp Gateway
 * Tempelkan script ini di Extensions → Apps Script pada Google Form Anda.
 * Setelah itu buat trigger "On form submit" untuk fungsi onFormSubmit().
 */

var API_URL = "${messagesEndpoint.value}";
var API_TOKEN = "${token.value || 'PASTE_YOUR_API_TOKEN'}";
var DEVICE_ID = "${deviceId.value}"; // target device

/**
 * Dipanggil otomatis setiap kali Google Form di-submit.
 * @param {Object} e - event berisi respons form
 */
function onFormSubmit(e) {
  var responses = e.response.getItemResponses();
  var data = {};

  for (var i = 0; i < responses.length; i++) {
    var item = responses[i];
    data[item.getItem().getTitle()] = item.getResponse();
  }

  var to = String(data["${phone}"] || "").replace(/[^0-9]/g, "");
  var message = String(data["${message}"] || "");

  if (!to) {
    Logger.log("Skipping: no phone number found for field '${phone}'");
    return;
  }

  sendWhatsApp(to, message);
}

function sendWhatsApp(to, message) {
  var payload = {
    to: to,
    message: message
  };
  payload.deviceId = DEVICE_ID;

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + API_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(API_URL, options);
  Logger.log("Sent to " + to + " → " + response.getResponseCode() + ": " + response.getContentText());
}`
})

function goBack() {
  router.push({ name: 'integrations' })
}

function onCopy() {
  copyScript(script.value)
}

function onDownload() {
  downloadScript('google-form-whatsapp.js', script.value)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-start gap-4">
      <Button variant="ghost" size="icon" class="shrink-0" title="Kembali" @click="goBack">
        <ArrowLeft class="h-4 w-4" />
      </Button>
      <div>
        <div class="flex items-center gap-2.5">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-violet-700 text-white">
            <FormInput class="h-5 w-5" />
          </div>
          <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
            Google Form
          </h2>
        </div>
        <p class="mt-1.5 text-sm text-slate-500">
          Otomatis kirim WhatsApp setiap kali Google Form di-submit.
        </p>
      </div>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Config -->
      <Card class="overflow-hidden p-0">
        <div class="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <FormInput class="h-4 w-4" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900">Konfigurasi</h3>
            <p class="text-xs text-slate-500">Sesuaikan nama field dengan Google Form Anda.</p>
          </div>
        </div>

        <div class="space-y-4 p-5">
          <label class="block space-y-1.5">
            <span class="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Phone class="h-3.5 w-3.5 text-slate-400" />
              Field Nomor Telepon
            </span>
            <input
              v-model="form.phoneField"
              type="text"
              placeholder="Phone"
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span class="block text-xs text-slate-400">Judul pertanyaan di Google Form untuk nomor HP penerima.</span>
          </label>

          <label class="block space-y-1.5">
            <span class="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <FormInput class="h-3.5 w-3.5 text-slate-400" />
              Field Pesan
            </span>
            <input
              v-model="form.messageField"
              type="text"
              placeholder="Message"
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span class="block text-xs text-slate-400">Judul pertanyaan yang berisi isi pesan.</span>
          </label>

          <label class="block space-y-1.5">
            <span class="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Smartphone class="h-3.5 w-3.5 text-slate-400" />
              Device
            </span>
            <select
              v-model="deviceId"
              required
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option v-for="d in (devices.devices || []).filter((d) => d && d.id)" :key="d.id" :value="d.id">
                {{ d.name }}{{ d.phoneNumber ? ` (${d.phoneNumber})` : '' }}
              </option>
            </select>
            <span class="block text-xs text-slate-400">Pilih device WhatsApp yang akan mengirim pesan.</span>
          </label>

          <label class="block space-y-1.5">
            <span class="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <KeyRound class="h-3.5 w-3.5 text-slate-400" />
              API Token
            </span>
            <input
              v-model="token"
              type="text"
              placeholder="PASTE_YOUR_API_TOKEN"
              class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span class="block text-xs text-slate-400">Token API Anda. Sudah terisi otomatis jika login.</span>
          </label>
        </div>

        <!-- Steps -->
        <div class="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Langkah pemasangan</h4>
          <ol class="space-y-2 text-xs text-slate-600">
            <li class="flex gap-2"><span class="font-bold text-primary">1.</span> Buka Google Form → tab <strong>Responses</strong> tidak perlu, langsung ke <strong>Extensions → Apps Script</strong>.</li>
            <li class="flex gap-2"><span class="font-bold text-primary">2.</span> Tempel script di kanan, lalu Save.</li>
            <li class="flex gap-2"><span class="font-bold text-primary">3.</span> Klik <strong>Triggers → Add trigger</strong>, pilih <code class="rounded bg-slate-200 px-1">onFormSubmit</code>, event <strong>On form submit</strong>.</li>
            <li class="flex gap-2"><span class="font-bold text-primary">4.</span> Submit form untuk test.</li>
          </ol>
        </div>
      </Card>

      <!-- Generated script -->
      <Card class="overflow-hidden p-0">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div class="flex items-center gap-2.5">
            <Info class="h-4 w-4 text-slate-400" />
            <h3 class="text-sm font-bold text-slate-900">Generated Script</h3>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="onDownload">
              <Download class="h-3.5 w-3.5" />
              Download
            </Button>
            <Button size="sm" @click="onCopy">
              <Check v-if="copied" class="h-3.5 w-3.5" />
              <Copy v-else class="h-3.5 w-3.5" />
              {{ copied ? 'Tersalin' : 'Copy' }}
            </Button>
          </div>
        </div>
        <div class="max-h-[28rem] overflow-auto bg-slate-950">
          <pre class="whitespace-pre p-4 font-mono text-xs leading-relaxed text-slate-200"><code>{{ script }}</code></pre>
        </div>
      </Card>
    </div>
  </div>
</template>
