# WhatsApp Notification Gateway Frontend

Vue.js 3 dashboard untuk SaaS WhatsApp Notification Gateway.

## Stack

- Vue 3 (Composition API + `<script setup>`)
- Pinia (state management)
- Vue Router (history mode + auth/admin guards)
- Tailwind CSS v4
- Axios (API client + JWT interceptor)
- Vite (build tool)

## Setup

```bash
cd frontend
npm install
npm run dev
```

Dashboard tersedia di `http://localhost:5173`. Dev server otomatis me-proxy `/api/*` ke backend di `http://localhost:3000` (lihat `vite.config.js`).

## Struktur

```
src/
├── components/
│   ├── common/      — reusable UI
│   ├── device/      — DeviceCard, QRCodeModal, DeviceStatusBadge
│   ├── billing/     — PackageCard, PaymentInstruction, UploadProofForm
│   └── admin/       — PaymentVerificationTable, UserTable
├── views/
│   ├── auth/        — Login.vue, Register.vue
│   ├── dashboard/   — Layout.vue, Overview.vue, Devices.vue, ApiKeys.vue, Logs.vue
│   ├── billing/     — ChoosePackage.vue, PaymentInstruction.vue, PaymentHistory.vue
│   └── admin/       — AdminPayments.vue, AdminUsers.vue, AdminDevices.vue
├── stores/          — auth.js, device.js, billing.js, apiKey.js (Pinia)
├── router/          — index.js (route guards: requiresAuth, requiresAdmin)
├── services/        — api.js (axios instance + interceptor token)
├── App.vue
└── main.js
```

## Alur Utama

1. **Register / Login** → JWT disimpan di localStorage
2. **Choose Package** → buat order transfer dengan kode unik
3. **Payment Instruction** → info rekening + upload bukti transfer
4. Admin approve (via Admin Payments) → subscription aktif
5. **Devices** → tambah device, scan QR (auto-poll status tiap 3s)
6. **API Keys** → generate (ditampilkan sekali) / revoke
7. **Logs** → riwayat pengiriman dengan filter status

## Build & Deploy

```bash
npm ci
npm run build   # hasil di dist/
```

Gunakan Node.js 20.19+ atau 22.12+. Node.js 22 direkomendasikan dan sudah
ditentukan di `.nvmrc`.

### Environment

```env
VITE_APP_NAME=My App
VITE_API_BASE_URL=/api
```

Pada Docker/Dokploy, kedua variabel tersebut dapat diatur sebagai runtime
environment dan diterapkan ketika container dijalankan. Pada hosting static
seperti aaPanel, keduanya dibaca saat proses build. Gunakan `/api` untuk proxy
dengan domain yang sama atau URL lengkap seperti `https://api.example.com/api`
jika backend berada di domain lain.

### Dokploy (Dockerfile)

Project sudah menyediakan `Dockerfile` production dengan multi-stage build,
Nginx, fallback Vue Router, proxy API, asset cache, proteksi stale HTML setelah
redeploy, dan health check.

1. Buat Application dari repository ini.
2. Pilih build type **Dockerfile**.
3. Isi Dockerfile Path dengan `Dockerfile` dan Docker Context Path dengan `.`.
4. Tambahkan domain dengan container port `80`.
5. Atur runtime environment:

   ```env
   VITE_APP_NAME=My App
   VITE_API_BASE_URL=/api
   BACKEND_URL=http://backend:3000
   ```

   `BACKEND_URL` adalah origin backend dan tidak perlu trailing `/api`; path
   request `/api/*` dipertahankan oleh proxy.

6. Build-time Arguments bersifat opsional karena konfigurasi Docker dapat
   diberikan saat runtime.
7. Deploy. Endpoint health check tersedia di `/healthz`.

Jika memakai `VITE_API_BASE_URL` berupa URL lengkap, pastikan backend
mengizinkan origin domain frontend melalui CORS. `BACKEND_URL` tidak digunakan
oleh browser pada mode tersebut.

Alternatif tanpa Dockerfile adalah build type **Nixpacks**, build command
`npm run build`, publish directory `./dist`, mode Static SPA aktif, dan port
domain `80`. Pada mode ini routing `/api` harus dibuat terpisah di Traefik atau
gunakan `VITE_API_BASE_URL` berupa URL backend lengkap.

### aaPanel

1. Pilih Node.js 22 dan jalankan:

   ```bash
   npm ci
   npm run build
   ```

2. Salin seluruh isi `dist/` ke document root website, misalnya
   `/www/wwwroot/app-frontend`.
3. Tambahkan isi `deploy/aapanel.nginx.conf` ke konfigurasi Nginx website.
4. Sesuaikan document root dan alamat backend
   `http://127.0.0.1:3000`, lalu reload Nginx.

Konfigurasi tersebut sudah menangani:

```nginx
- fallback SPA agar route seperti `/devices` tidak menghasilkan 404;
- reverse proxy `/api/*` ke backend;
- WebSocket upgrade;
- cache jangka panjang untuk asset hasil build.
```

## Akun Default

- User: register akun baru via UI
- Admin: `admin@instsdr.id` / `admin12345` (dari seed backend)
