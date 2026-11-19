# Deploy Neowa di Dokploy

Project ini dijalankan sebagai satu layanan **Docker Compose** yang terdiri dari
backend Bun + Elysia dan WA Connector. Database PostgreSQL dan Redis dijalankan secara
eksternal (misalnya melalui menu Database di Dokploy atau cloud database seperti
Neon/Supabase/Upstash) untuk menghemat resource RAM dan CPU server.

## 1. Buat layanan

1. Push repository ini ke Git provider yang dapat diakses Dokploy.
2. Di Dokploy, buat Project lalu pilih **Create Service > Docker Compose**.
3. Pilih repository dan branch yang akan digunakan.
4. Isi Compose Path dengan `docker-compose.yml` (atau biarkan nilai default
   `./docker-compose.yml`).
5. Gunakan tipe **Docker Compose**, bukan Docker Stack, karena image dibangun
   langsung dari source melalui `build`.

## 2. Environment

Salin seluruh variable dari `.env.dokploy.example` ke tab **Environment**.
Ganti minimal nilai berikut dengan secret acak yang kuat:

- `DATABASE_URL`: Connection string PostgreSQL eksternal / Dokploy database service.
- `REDIS_URL`: Connection string Redis eksternal / Dokploy redis service.
- `DB_SSL`: `true` jika menggunakan cloud provider dengan SSL (Neon/Supabase), atau `false` untuk koneksi lokal/internal.
- `JWT_SECRET`
- `WA_CONNECTOR_TOKEN`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

Untuk notifikasi, konfigurasi juga:

- `APP_URL`: URL dashboard/frontend untuk tombol email dan reset password.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`,
  `MAIL_FROM`: akun SMTP pengirim email.
- `NOTIFICATION_WA_DEVICE_ID`: UUID device WhatsApp yang sudah connected dan
  akan menjadi pengirim notifikasi sistem.

Jangan commit file `.env` berisi secret ke repository.

Backend menjalankan seed idempotent sebelum start. Proses ini membuat skema
database, paket awal, dan admin pertama. Setelah admin berhasil dibuat, nilai
`SEED_ADMIN_EMAIL` dan `SEED_ADMIN_PASSWORD` boleh dikosongkan lalu deploy ulang.

## 3. Domain

Di tab **Domains** layanan Compose:

1. Tambahkan domain API, misalnya `api.example.com`.
2. Pilih service `backend`.
3. Isi Container Port `3000`.
4. Isi Path `/` dan aktifkan HTTPS/Let's Encrypt.

Jangan memberi domain atau membuka port publik untuk `wa-connector`.

## 4. Deploy dan verifikasi

Klik **Deploy**, lalu periksa:

- Semua service berstatus healthy.
- `https://api.example.com/health` menghasilkan `{"status":"ok"}`.
- `https://api.example.com/docs` membuka dokumentasi API.
- Login menggunakan admin seed berhasil.
- QR device dapat dibuat dan tetap tersimpan setelah redeploy.

## Persistence dan backup

Compose menggunakan named volume:

- `wa_sessions`: sesi login WhatsApp
- `backend_uploads`: bukti transfer

Aktifkan backup volume Dokploy untuk `wa_sessions` dan `backend_uploads`. Jangan menghapus volume saat redeploy.

## Update

Push perubahan ke branch yang dipilih lalu lakukan redeploy. Backend dan
connector akan dibangun ulang, sedangkan data tetap berada di named volume.
