<script setup>
import { computed, reactive } from 'vue'
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
  FileSpreadsheet,
  Info,
  KeyRound,
  Columns3,
  Smartphone,
} from 'lucide-vue-next'

const router = useRouter()
const { token, copied, messagesEndpoint, devices, deviceId, copyScript, downloadScript } = useScriptGenerator()

const form = reactive({
  phoneColumn: 'B',
  messageColumn: 'C',
  sheetName: 'Sheet1',
  headerRow: '1',
})

const error = ''

/**
 * Build a Google Apps Script that sends WhatsApp messages for each row
 * in a Google Spreadsheet via the Gateway API, with a custom menu + a
 * "status" column so rows aren't sent twice.
 */
const script = computed(() => {
  const phoneCol = (form.phoneColumn.trim() || 'B').toUpperCase()
  const msgCol = (form.messageColumn.trim() || 'C').toUpperCase()
  const sheet = form.sheetName.trim() || 'Sheet1'
  const header = parseInt(form.headerRow) || 1

  return `/**
 * Google Spreadsheet → WhatsApp Gateway
 * Tempelkan script ini di Extensions → Apps Script pada Google Spreadsheet Anda.
 * Menambahkan menu "WhatsApp" dengan opsi kirim per baris atau massal.
 */

var API_URL = "${messagesEndpoint.value}";
var API_TOKEN = "${token.value || 'PASTE_YOUR_API_TOKEN'}";
var DEVICE_ID = "${deviceId.value}"; // target device
var SHEET_NAME = "${sheet}";
var PHONE_COL = "${phoneCol}";     // kolom nomor HP
var MESSAGE_COL = "${msgCol}";     // kolom isi pesan
var STATUS_COL = "D";              // kolom status (ditulis otomatis)
var HEADER_ROW = ${header};        // baris header, data mulai baris berikutnya

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('WhatsApp')
    .addItem('Kirim baris terpilih', 'sendSelectedRow')
    .addItem('Kirim semua baris', 'sendAllRows')
    .addToUi();
}

function sendSelectedRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var row = sheet.getActiveCell().getRow();
  if (row <= HEADER_ROW) {
    SpreadsheetApp.getUi().alert('Pilih baris data (di bawah header).');
    return;
  }
  processRow(sheet, row);
}

function sendAllRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var lastRow = sheet.getLastRow();
  var sent = 0;
  for (var r = HEADER_ROW + 1; r <= lastRow; r++) {
    if (processRow(sheet, r)) sent++;
  }
  SpreadsheetApp.getUi().alert('Selesai. ' + sent + ' pesan diproses.');
}

function processRow(sheet, row) {
  var phone = sheet.getRange(row + '1' + PHONE_COL).blank
    ? sheet.getRange(PHONE_COL + row).getValue()
    : sheet.getRange(PHONE_COL + row).getValue();
  var message = sheet.getRange(MESSAGE_COL + row).getValue();
  var status = sheet.getRange(STATUS_COL + row).getValue();

  if (status === 'Sent') return false;          // skip baris yang sudah terkirim
  phone = String(phone).replace(/[^0-9]/g, '');
  if (!phone || !message) return false;          // skip baris kosong

  var ok = sendWhatsApp(phone, String(message));
  sheet.getRange(STATUS_COL + row).setValue(ok ? 'Sent' : 'Failed');
  return true;
}

function sendWhatsApp(to, message) {
  var payload = { to: to, message: message };
  payload.deviceId = DEVICE_ID;

  var options = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + API_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(API_URL, options);
    return response.getResponseCode() === 200 || response.getResponseCode() === 201;
  } catch (err) {
    Logger.log("Error sending to " + to + ": " + err);
    return false;
  }
}`
})

function goBack() {
  router.push({ name: 'integrations' })
}

function onCopy() {
  copyScript(script.value)
}

function onDownload() {
  downloadScript('google-spreadsheet-whatsapp.js', script.value)
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
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-emerald-500 to-emerald-700 text-white">
            <FileSpreadsheet class="h-5 w-5" />
          </div>
          <h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
            Google Spreadsheet
          </h2>
        </div>
        <p class="mt-1.5 text-sm text-slate-500">
          Kirim WhatsApp langsung dari baris Google Spreadsheet lewat Apps Script.
        </p>
      </div>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Config -->
      <Card class="overflow-hidden p-0">
        <div class="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <FileSpreadsheet class="h-4 w-4" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900">Konfigurasi</h3>
            <p class="text-xs text-slate-500">Sesuaikan kolom & sheet dengan Spreadsheet Anda.</p>
          </div>
        </div>

        <div class="space-y-4 p-5">
          <div class="grid grid-cols-2 gap-4">
            <label class="block space-y-1.5">
              <span class="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Columns3 class="h-3.5 w-3.5 text-slate-400" />
                Kolom No. HP
              </span>
              <input
                v-model="form.phoneColumn"
                type="text"
                placeholder="B"
                class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label class="block space-y-1.5">
              <span class="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Columns3 class="h-3.5 w-3.5 text-slate-400" />
                Kolom Pesan
              </span>
              <input
                v-model="form.messageColumn"
                type="text"
                placeholder="C"
                class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <label class="block space-y-1.5">
              <span class="text-sm font-medium text-slate-700">Nama Sheet</span>
              <input
                v-model="form.sheetName"
                type="text"
                placeholder="Sheet1"
                class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label class="block space-y-1.5">
              <span class="text-sm font-medium text-slate-700">Baris Header</span>
              <input
                v-model="form.headerRow"
                type="number"
                min="1"
                placeholder="1"
                class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>

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
              <option v-for="d in devices.devices" :key="d.id" :value="d.id">
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
            <li class="flex gap-2"><span class="font-bold text-primary">1.</span> Buka Spreadsheet → <strong>Extensions → Apps Script</strong>.</li>
            <li class="flex gap-2"><span class="font-bold text-primary">2.</span> Tempel script di kanan, lalu Save & Refresh Spreadsheet.</li>
            <li class="flex gap-2"><span class="font-bold text-primary">3.</span> Menu <strong>WhatsApp</strong> muncul di atas — pilih kirim per baris atau massal.</li>
            <li class="flex gap-2"><span class="font-bold text-primary">4.</span> Status tercatat otomatis di kolom D (<code class="rounded bg-slate-200 px-1">Sent</code>/<code class="rounded bg-slate-200 px-1">Failed</code>).</li>
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
