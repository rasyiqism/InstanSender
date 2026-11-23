# RPD — SaaS WhatsApp Notification Gateway

## 1. Ringkasan Eksekutif
Produk ini adalah layanan **SaaS pengiriman notifikasi via WhatsApp** (bukan chatbot dua arah). Pengguna mendaftar, memilih paket berdasarkan jumlah device/kuota pesan, menghubungkan nomor WhatsApp mereka via scan QR code, lalu mendapatkan **API Key** untuk dipakai sistem pihak ketiga (misalnya sistem e-commerce, HRIS, atau billing) guna mengirim notifikasi transaksional (OTP, invoice, reminder, status pesanan, dll).

## 2. Tujuan Produk
- Menyediakan gateway notifikasi WhatsApp yang murah, ringan, dan mudah diintegrasikan lewat REST API.
- Mendukung banyak tenant (multi-device, multi-user) dalam satu infrastruktur secara scalable.
- Meminimalkan risiko pemblokiran nomor dengan pengelolaan rate limit & antrian pesan yang baik.

## 3. Target Pengguna
- Bisnis kecil-menengah yang butuh kirim notifikasi otomatis (toko online, klinik, koperasi, sekolah).
- Developer/agency yang mengintegrasikan notifikasi WA ke sistem internal klien.

## 4. Lingkup Produk

**In-scope (MVP):**
- Kirim pesan teks & media (gambar/dokumen) satu arah dari sistem ke pelanggan.
- Manajemen device (nomor WA) per user.
- Manajemen paket & kuota.
- API Key untuk autentikasi pihak ketiga.
- Dashboard monitoring status device & log pengiriman.

**Out-of-scope (fase awal):**
- Chatbot / auto-reply dua arah.
- Broadcast massal ke banyak nomor sekaligus (blast marketing) — berisiko tinggi kena banned, bisa jadi fitur premium terpisah nanti dengan disclaimer.
- Multi-channel (SMS, email) — bisa jadi roadmap fase 3.

## 5. Alur Pengguna (User Flow)

1. **Register / Login** — email + password atau OAuth (Google).
2. **Pilih Paket** — user memilih paket sesuai kebutuhan (jumlah device & kuota pesan/bulan). Sistem menampilkan instruksi **transfer bank** (nomor rekening tujuan, nominal, kode unik/berita transfer) dan user mengunggah bukti transfer. Status order: `menunggu verifikasi`.
3. **Verifikasi Admin** — admin mengecek mutasi rekening secara manual, lalu mengubah status pembayaran menjadi **`paid`** lewat panel admin. Sistem otomatis mengaktifkan/memperpanjang subscription & kuota sesuai paket begitu status diubah.
4. **Tambah Device** — setelah paket aktif, user klik "Tambah Device", sistem membuat sesi baru dan menampilkan **QR Code**.
5. **Scan QR** — user scan lewat aplikasi WhatsApp di HP. Sistem mendeteksi event `connected` dari library dan menyimpan session.
6. **Device Aktif** — status device berubah jadi *connected*, muncul di dashboard.
7. **Generate API Key** — user generate API key yang terikat ke device tertentu (atau ke akun, tergantung skema).
8. **Integrasi Pihak Ketiga** — pihak ketiga memanggil endpoint API (`POST /v1/messages/send`) dengan API key di header untuk mengirim notifikasi.
9. **Monitoring** — user memantau log pengiriman (sukses/gagal), sisa kuota, dan status koneksi device di dashboard.

## 6. Fitur Utama (Modul)

| Modul | Deskripsi |
|---|---|
| Auth & User Management | Register, login, reset password, verifikasi email |
| Billing & Paket | Pilihan paket, upgrade/downgrade, upload bukti transfer bank, verifikasi manual oleh admin |
| Admin Panel | Verifikasi/tolak pembayaran, ubah status order jadi `paid`, kelola user & paket, lihat semua device/log |
| Device Management | Tambah/hapus device, scan QR, reconnect, status real-time |
| API Key Management | Generate, revoke, regenerate API key, scoping per device |
| Messaging Gateway | Endpoint kirim pesan, antrian, retry, rate limiting |
| Dashboard & Log | Riwayat pengiriman, status delivery, grafik penggunaan kuota |
| Webhook (opsional) | Notifikasi balik ke sistem pihak ketiga saat status pesan berubah (sent/delivered/failed) |

## 7. Contoh Skema Paket

| Paket | Jumlah Device | Kuota Pesan/Bulan | Harga (contoh) |
|---|---|---|---|
| Starter | 1 device | unlimited pesan | Rp 99.000 |
| Business | 3 device | unlimited pesan | Rp 299.000 |
| Enterprise | 10 device | unlimited pesan | Rp 999.000 |


## 8. Pemilihan Library WhatsApp

Kebutuhan: **ringan** (tidak butuh headless browser), **scalable** (banyak sesi device sekaligus), dan mudah dijalankan di server **aaPanel** yang umumnya spek terbatas.

| Library | Basis | Kelebihan | Kekurangan |
|---|---|---|---|
| **whatsmeow** (Go) | WebSocket langsung ke WhatsApp multi-device protocol | Goroutine sangat ringan per koneksi → hemat RAM/CPU untuk banyak device sekaligus; compile jadi 1 binary, deploy sebagai systemd service di aaPanel tanpa dependency runtime; ada built-in session store (SQLite/Postgres) | Berbasis Go, perlu dibungkus jadi service/API terpisah kalau backend utama pakai bahasa lain; unofficial |
| Baileys (Node.js) | WebSocket, sama-sama protokol multi-device | Native JS, gampang nyatu kalau backend utama Node.js, komunitas besar | Lebih boros resource per device (proses Node + crypto CPU-bound), butuh manajemen worker/cluster untuk isolasi saat device banyak |
| Official WhatsApp Business API (Cloud API) | Resmi Meta | Legal penuh, tanpa scan QR | Berbayar per konversasi, proses approval, tidak cocok untuk model "scan QR nomor pribadi" |

**Rekomendasi: whatsmeow**, karena paling efisien untuk deployment di VPS aaPanel dengan banyak device/tenant, dan lebih ringan dibanding Baileys pada skala besar.

**Pola implementasi:** whatsmeow dijalankan sebagai **microservice terpisah (WA Connector Service)** — hanya menangani scan QR, koneksi device, dan kirim/terima pesan, diekspos lewat HTTP API internal (mis. `POST /internal/wa/send`, `POST /internal/wa/device/:id/qr`). Backend utama SaaS (auth, billing, dashboard, API key management) tetap bisa dibangun terpisah (Node.js/PHP/lainnya) dan cukup memanggil API internal ini. Di aaPanel, binary Go dijalankan sebagai service (systemd/supervisor) di port internal, backend utama berkomunikasi lewat HTTP/gRPC secara lokal.

Perlu dicatat ke user/klien: ini menggunakan protokol tidak resmi sehingga ada risiko perubahan/pemblokiran oleh WhatsApp — mitigasi dijelaskan di bagian Risiko.

## 9. Arsitektur Teknis (High-Level)

```
[Pihak Ketiga] --(API Key)--> [API Gateway / Backend Utama] --> [Auth/Rate-Limit/Kuota]
                                                        |
                                                        v
                                              [Message Queue (Redis)]
                                                        |
                                                        v
                                    [WA Connector Service (Go + whatsmeow)]
                                      (1 goroutine/session per device,
                                       bisa dijalankan multi-instance/sharded)
                                                        |
                                                        v
                                                 [WhatsApp Network]
```

Komponen:
- **API Gateway / Backend Utama**: menerima request dari pihak ketiga, validasi API key, cek kuota, push job ke queue. Bisa dibangun terpisah dari WA Connector Service (mis. Node.js/PHP), berkomunikasi via HTTP API internal.
- **Queue (Redis)**: menampung antrian pesan per device agar tidak mengirim terlalu cepat (menghindari flag spam) dan mendukung retry otomatis.
- **WA Connector Service (Go + whatsmeow)**: microservice yang menjalankan session per device (goroutine ringan), menangani scan QR, koneksi, dan pengiriman pesan aktual. Session credential disimpan lewat store bawaan whatsmeow (SQLite/Postgres) agar bisa reconnect tanpa scan ulang.
- **Database utama (PostgreSQL)**: users, packages, subscriptions, devices, api_keys, message_logs, payments.
- **Redis**: queue, cache status device, rate limiting counter.
- **Scaling device**: karena tiap device = koneksi persisten (WebSocket), device bisa disebar ke beberapa instance WA Connector Service (sharding, dicatat di DB) untuk scaling horizontal — cukup tambah instance baru saat device makin banyak.

## 10. Skema Database (Ringkas)

- `users` (id, name, email, password_hash, role[user/admin], created_at)
- `packages` (id, name, max_device, message_quota, price)
- `subscriptions` (id, user_id, package_id, status, start_date, end_date)
- `payments` (id, user_id, subscription_id, amount, bank_account_tujuan, kode_unik, bukti_transfer_url, status[pending/paid/rejected], verified_by (admin_id), verified_at, created_at)
- `devices` (id, user_id, name, phone_number, status[connected/disconnected/pending_qr], session_data_ref, worker_node)
- `api_keys` (id, user_id, device_id (nullable), key_hash, scope, created_at, revoked_at)
- `message_logs` (id, device_id, api_key_id, recipient, message_type, status, sent_at)
- `webhooks` (id, user_id, url, event_type, secret)

## 11. Autentikasi & Integrasi API

Contoh endpoint:
```
POST /v1/messages/send
Header: Authorization: Bearer <API_KEY>
Body:
{
  "to": "628123456789",
  "type": "text",
  "message": "Pesanan Anda #1234 telah dikirim."
}
```

- API key di-hash saat disimpan (jangan simpan plaintext).
- Setiap request dicatat ke `message_logs` dan dikurangi dari kuota paket.
- Rate limit per API key sesuai paket (mis. Starter: 10 req/detik).
- Opsional: webhook callback ke URL pihak ketiga saat status berubah (`sent`, `delivered`, `failed`).

## 12. Alur Pembayaran Manual (Bank Transfer)

1. User pilih paket → sistem generate order dengan **kode unik** (mis. tambahan 3 digit di akhir nominal) agar mutasi mudah dicocokkan otomatis/manual, status `pending`.
2. Sistem menampilkan info rekening tujuan + nominal + kode unik, dan form upload bukti transfer (opsional tapi disarankan).
3. Admin login ke **Admin Panel**, melihat daftar order `pending`, mencocokkan dengan mutasi rekening.
4. Admin klik **"Tandai Lunas"** → status `payments.status` berubah jadi `paid`, tercatat `verified_by` & `verified_at`.
5. Sistem otomatis meng-*update* `subscriptions` (aktif/extend end_date) dan menambah kuota device/pesan sesuai paket.
6. User mendapat notifikasi (email/dashboard) bahwa paket sudah aktif.
7. Jika bukti transfer tidak valid, admin bisa ubah status jadi `rejected` dengan catatan alasan.

Catatan: karena verifikasi manual, tidak perlu integrasi payment gateway (Midtrans/Xendit) di fase awal — mengurangi kompleksitas & biaya transaksi. Bisa ditambahkan di fase lanjut sebagai opsi pembayaran otomatis.

## 14. Keamanan
- Enkripsi session/auth-state whatsmeow saat disimpan (at-rest encryption).
- Isolasi antar tenant di level koneksi/instance agar satu device bermasalah tidak mengganggu device lain.
- Audit log untuk aktivitas generate/revoke API key dan verifikasi pembayaran (siapa admin yang approve, kapan).
- 2FA opsional untuk login dashboard, wajib untuk akun admin.
- Upload bukti transfer disimpan di storage terenkripsi/private, tidak bisa diakses publik.

## 15. Reliability & Monitoring
- Auto-reconnect jika koneksi WA Connector Service (whatsmeow) terputus.
- Health check berkala per device; jika disconnect > X menit, kirim notifikasi ke user untuk scan ulang QR.
- Retry dengan backoff untuk pesan gagal terkirim.
- Dashboard metrik: jumlah pesan terkirim, gagal, sisa kuota, uptime device, dan reminder untuk order pembayaran yang masih `pending` lebih dari X jam.

## 16. Tech Stack Usulan
- **WA Connector Service**: Go + whatsmeow (microservice terpisah, session per device)
- **Backend Utama**: Bun runtime + ElysiaJS + Drizzle ORM, berkomunikasi ke WA Connector Service via HTTP internal
- **Queue**: Redis
- **Database**: PostgreSQL
- **Frontend Dashboard**: Vue.js 3 (Composition API) + Pinia + Tailwind CSS
- **Deployment**: aaPanel — WA Connector Service (Go binary) sebagai systemd/supervisor service, backend utama sebagai Node.js/PHP project di aaPanel, Nginx sebagai reverse proxy
- **Pembayaran**: manual bank transfer + verifikasi admin (tanpa payment gateway pihak ketiga di fase awal)

## 17. Arsitektur Frontend (Vue.js 3)

### 17.1 Stack & Alasan Pemilihan
- **Vue.js 3** (Composition API + `<script setup>`) — reactivity system ringan, learning curve rendah, cocok untuk dashboard SaaS dengan banyak state real-time (status device, kuota, log).
- **Pinia** — state management resmi Vue 3, lebih sederhana dari Vuex, mendukung TypeScript dengan baik.
- **Vue Router** — routing untuk halaman auth, dashboard, admin.
- **Tailwind CSS** — utility-first styling, konsisten dengan rekomendasi tech stack sebelumnya.
- **Axios** — HTTP client ke backend utama (REST API).
- **Vite** — build tool bawaan Vue 3, dev server cepat, cocok untuk deploy static build ke aaPanel (cukup upload hasil `dist/` ke Nginx).
- **Socket.IO client / WebSocket** (opsional) — untuk update status device & QR code secara real-time tanpa polling terus-menerus (mis. saat menunggu scan QR, status berubah otomatis begitu backend mendeteksi `connected`).

### 17.2 Struktur Folder (Ringkas)
```
src/
├── assets/
├── components/
│   ├── common/          (Button, Modal, Table, Badge, dll — reusable)
│   ├── device/          (DeviceCard, QRCodeModal, DeviceStatusBadge)
│   ├── billing/         (PackageCard, PaymentInstruction, UploadProofForm)
│   └── admin/           (PaymentVerificationTable, UserTable)
├── views/
│   ├── auth/            (Login.vue, Register.vue, ForgotPassword.vue)
│   ├── dashboard/       (Overview.vue, Devices.vue, ApiKeys.vue, Logs.vue)
│   ├── billing/         (ChoosePackage.vue, PaymentInstruction.vue, PaymentHistory.vue)
│   └── admin/           (AdminPayments.vue, AdminUsers.vue, AdminDevices.vue)
├── stores/              (Pinia: auth.js, device.js, billing.js, apiKey.js)
├── router/              (index.js — termasuk route guard auth & role admin)
├── services/            (api.js — instance axios + interceptor token, wsClient.js)
└── App.vue, main.js
```

### 17.3 Pemetaan Halaman ke Alur Pengguna

| Halaman (View) | Fungsi | Terhubung ke Modul Backend |
|---|---|---|
| `Login.vue` / `Register.vue` | Autentikasi user | Auth & User Management |
| `ChoosePackage.vue` | Pilih paket | Billing & Paket |
| `PaymentInstruction.vue` | Tampilkan rekening tujuan, kode unik, upload bukti transfer | Billing & Paket (payments) |
| `Devices.vue` | List device, tombol "Tambah Device", modal QR Code (auto-refresh status via polling/WebSocket) | Device Management, WA Connector Service |
| `ApiKeys.vue` | Generate/revoke API key per device | API Key Management |
| `Logs.vue` | Riwayat pengiriman pesan, filter status | Messaging Gateway |
| `AdminPayments.vue` | List order `pending`, tombol "Tandai Lunas"/"Tolak" | Admin Panel (verifikasi payments) |
| `AdminUsers.vue`, `AdminDevices.vue` | Kelola user & monitor semua device lintas tenant | Admin Panel |

### 17.4 State Management (Pinia) — Contoh Store
- `useAuthStore`: token JWT, data user login, role, fungsi login/logout, route guard.
- `useDeviceStore`: daftar device, status real-time, fungsi fetch QR baru, reconnect.
- `useBillingStore`: paket dipilih, status order pembayaran, riwayat pembayaran.
- `useApiKeyStore`: daftar API key per device, generate/revoke.

### 17.5 Integrasi Real-time QR & Status Device
Karena scan QR butuh update status cepat (dari `pending_qr` → `connected`), disarankan salah satu dari:
1. **Polling ringan** (interval 2–3 detik) ke endpoint status device — paling sederhana, cukup untuk MVP.
2. **WebSocket/Socket.IO** dari backend utama yang menerima event dari WA Connector Service — lebih real-time, direkomendasikan begitu traffic bertambah.

### 17.6 Build & Deployment di aaPanel
- Build production dengan `vite build` menghasilkan folder `dist/` (static files).
- Upload `dist/` ke direktori project di aaPanel, serve lewat Nginx sebagai static site.
- Konfigurasi Nginx `try_files` untuk mendukung client-side routing (Vue Router history mode) agar refresh di halaman dalam (`/dashboard/devices`) tidak 404.
- API backend dapat di-reverse-proxy pada subdomain terpisah agar endpoint tersedia langsung dari root path.

## 18. Roadmap Bertahap

**Fase 1 (MVP):**
Auth, pilih paket, alur transfer bank + verifikasi admin manual, tambah device + scan QR (whatsmeow), generate API key, endpoint kirim pesan teks, dashboard log dasar.

**Fase 2:**
Kirim media (gambar/dokumen), webhook status, rate limiting per paket, notifikasi otomatis (email/WA) saat pembayaran diverifikasi, laporan keuangan sederhana untuk admin.

**Fase 3:**
Scaling multi-instance WA Connector Service, analytics lanjutan, opsi payment gateway otomatis (opsional), dukungan multi-channel.

## 19. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Nomor WA diblokir karena kirim terlalu cepat/masif | Terapkan rate limit & delay antar pesan per device, larang broadcast massal |
| whatsmeow berhenti berfungsi akibat perubahan protokol WA | Pantau update repo whatsmeow secara rutin, siapkan fallback ke WhatsApp Cloud API resmi untuk klien enterprise |
| Kehilangan session saat server restart | Manfaatkan store bawaan whatsmeow (SQLite/Postgres) sebagai persistensi, bukan hanya di memori |
| Penyalahgunaan API key | Hashing key, mekanisme revoke cepat, rate limit, log akses |
| Salah/telat verifikasi pembayaran manual | SOP jelas untuk admin (cek mutasi harian), kode unik nominal untuk memudahkan pencocokan, reminder otomatis untuk order yang lama `pending` |
| Bukti transfer palsu/manipulasi | Admin selalu cross-check dengan mutasi rekening asli, bukan hanya dari gambar bukti transfer |

---
*Dokumen ini adalah rancangan awal (RPD) dan dapat disesuaikan lebih lanjut sesuai kebutuhan bisnis, estimasi biaya infrastruktur, dan target skala pengguna.*

Panduan Deploy Neowa ke aaPanel
Arsitektur deploy yang paling rapi:
Frontend Vue: static files di Nginx aaPanel.
Backend Bun + Elysia: Bun runtime service port 3000.
WA Connector Go: internal service port 8080.
PostgreSQL: database utama.
Redis: queue/rate limit.
Nginx: reverse proxy domain API ke backend.
1. Siapkan Software di aaPanel
Install dari App Store aaPanel:
Nginx
PostgreSQL
Redis
Bun runtime (curl -fsSL https://bun.sh/install | bash)
Supervisor Manager, untuk WA Connector Go dan Backend Bun
Go compiler, bisa via terminal kalau belum ada
Cek versi:
bun -v
go version
redis-cli ping
2. Upload Project
Contoh lokasi:
/www/wwwroot/neowa-api
/www/wwwroot/neowa-frontend
Struktur:
/www/wwwroot/neowa-api/backend
/www/wwwroot/neowa-api/wa-connector
/www/wwwroot/neowa-frontend
3. Database PostgreSQL
Buat database dan user di aaPanel PostgreSQL:
CREATE DATABASE neowa;
CREATE USER neowa_user WITH PASSWORD 'password-kuat';
GRANT ALL PRIVILEGES ON DATABASE neowa TO neowa_user;
Connection string nanti:
DATABASE_URL=postgres://neowa_user:password-kuat@127.0.0.1:5432/neowa
4. Deploy Backend Bun + Elysia
Masuk folder backend:
cd /www/wwwroot/neowa-api/backend
bun install --production
Buat file .env:
PORT=3000
NODE_ENV=production

DATABASE_URL=postgres://neowa_user:password-kuat@127.0.0.1:5432/neowa

JWT_SECRET=ganti-dengan-random-secret-panjang
JWT_EXPIRES_IN=7d

REDIS_URL=redis://127.0.0.1:6379

WA_CONNECTOR_URL=http://127.0.0.1:8080
WA_CONNECTOR_TOKEN=ganti-token-internal-panjang-sama-dengan-connector

BANK_NAME=BCA
BANK_ACCOUNT_NUMBER=1234567890
BANK_ACCOUNT_HOLDER=PT Neowa Indonesia

UPLOAD_DIR=/www/wwwroot/neowa-api/backend/uploads

Migrasi schema database dengan Drizzle:
bun run db:push

Seed data awal (admin & paket):
bun run seed

Default admin dari project:
admin@neowa.id / admin12345
Ganti password admin setelah login.

Jalankan backend via Supervisor aaPanel atau PM2:
pm2 start "bun src/index.ts" --name neowa-backend
pm2 save
pm2 startup

Cek health:
curl http://127.0.0.1:3000/health
5. Deploy WA Connector
Masuk folder connector:
cd /www/wwwroot/neowa-api/wa-connector
go mod tidy
go build -o wa-connector
Buat file env untuk service, misalnya /www/wwwroot/neowa-api/wa-connector/.env:
PORT=8080
INTERNAL_TOKEN=ganti-token-internal-panjang-sama-dengan-backend
SESSION_DB=/www/wwwroot/neowa-api/wa-connector/wa-sessions.db
BACKEND_URL=http://127.0.0.1:3000
Jalankan via Supervisor aaPanel:
Command:
/www/wwwroot/neowa-api/wa-connector/wa-connector
Working directory:
/www/wwwroot/neowa-api/wa-connector
Environment isi sesuai .env di atas. Kalau Supervisor tidak support env file, masukkan env langsung di panel atau buat shell wrapper.
Contoh wrapper start-wa.sh:
#!/bin/bash
export PORT=8080
export INTERNAL_TOKEN="ganti-token-internal-panjang-sama-dengan-backend"
export SESSION_DB="/www/wwwroot/neowa-api/wa-connector/wa-sessions.db"
export BACKEND_URL="http://127.0.0.1:3000"
cd /www/wwwroot/neowa-api/wa-connector
exec ./wa-connector
Lalu:
chmod +x start-wa.sh
Supervisor command:
/www/wwwroot/neowa-api/wa-connector/start-wa.sh
Cek:
curl http://127.0.0.1:8080/internal/wa/device/test/status
Tanpa token mungkin 401, itu normal.
6. Build Frontend
Masuk folder frontend:
cd /www/wwwroot/neowa-frontend
npm install
npm run build
Hasil build ada di:
/www/wwwroot/neowa-frontend/dist
Frontend memakai baseURL domain API, misalnya `https://api.example.com`.
7. Konfigurasi Website Nginx aaPanel
Buat website, misalnya:
neowa.domainanda.com
Root directory:
/www/wwwroot/neowa-frontend/dist
Tambahkan konfigurasi Nginx:
location / {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    client_max_body_size 20m;
}

location / {
    try_files $uri $uri/ /index.html;
}
Aktifkan SSL dari aaPanel SSL/Let’s Encrypt.
8. Firewall
Expose hanya:
80
443
Jangan expose publik:
3000
8080
5432
6379
Backend dan connector cukup 127.0.0.1.
9. Test Setelah Deploy
Cek frontend:
https://neowa.domainanda.com
Cek API docs:
https://neowa.domainanda.com/docs
Cek login admin, lalu:
Login admin.
Buka Admin Packages, Users, Payments.
Tambah device.
Scan QR WhatsApp.
Test send text/image dengan API key.
10. Command Update Versi Baru
Backend:
cd /www/wwwroot/neowa-api/backend
npm install
npm run build
pm2 restart neowa-backend
WA Connector:
cd /www/wwwroot/neowa-api/wa-connector
go build -o wa-connector
# restart dari Supervisor aaPanel
Frontend:
cd /www/wwwroot/neowa-frontend
npm install
npm run build
Yang paling penting untuk production: ganti JWT_SECRET, WA_CONNECTOR_TOKEN/INTERNAL_TOKEN, password database, dan password admin default.
