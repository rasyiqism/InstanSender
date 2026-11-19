# Neowa Backend API

NestJS backend utama untuk SaaS WhatsApp Notification Gateway.

## Teknologi

- NestJS + TypeScript
- PostgreSQL (TypeORM)
- Redis + BullMQ (queue & rate limit)
- JWT Passport auth + role `admin`

## Setup Lokal

1. Pastikan PostgreSQL & Redis berjalan (contoh via Docker):

```bash
cd backend
docker compose up -d
```

2. Copy environment:

```bash
cp .env.example .env
# edit .env sesuai kebutuhan
```

3. Install & seed data awal:

```bash
npm install
npm run seed
```

4. Jalankan:

```bash
npm run start:dev
```

API tersedia di `http://localhost:3000`.

## Akun Default

Setelah seed berjalan:

- Admin: `admin@neowa.id` / `admin12345`
- Paket yang tersedia: Starter, Business, Enterprise

## Arsitektur Endpoint Utama

| Endpoint | Deskripsi |
|---|---|
| `POST /auth/register` | Register user |
| `POST /auth/login` | Login, mengembalikan JWT |
| `POST /auth/forgot-password` | Kirim instruksi reset password |
| `POST /auth/reset-password` | Atur password baru dengan token sekali pakai |
| `GET /packages` | Daftar paket aktif |
| `POST /billing/orders` | Pilih paket, buat order transfer |
| `POST /billing/orders/:id/proof` | Upload bukti transfer |
| `GET /devices` | List device user |
| `POST /devices` | Tambah device, mulai sesi QR |
| `GET /devices/:id/qr` | Ambil QR code terbaru |
| `GET /devices/:id/status` | Poll status device |
| `GET /api-keys` | List API key |
| `POST /api-keys` | Generate API key baru |
| `POST /v1/messages/send` | Kirim pesan via API key |
| `POST /v1/groups` | Daftar grup WhatsApp yang diikuti device |
| `POST /v1/groups/members` | Scrape kontak anggota sebuah grup via API key |
| `GET /admin/payments/pending` | Admin: order pending |
| `POST /admin/payments/:id/approve` | Admin: tandai lunas |

Saat register, kirim `phoneNumber` dalam format internasional tanpa `+`
(contoh `628123456789`) agar pengguna dapat menerima notifikasi WhatsApp.

## Notifikasi Sistem

Email dan WhatsApp dikirim untuk:

- registrasi akun;
- permintaan lupa password;
- pembuatan order;
- reminder subscription H-15, H-7, dan H-3 sebelum berakhir.

Konfigurasikan SMTP melalui `SMTP_*`, URL frontend melalui `APP_URL`, device
pengirim WhatsApp melalui `NOTIFICATION_WA_DEVICE_ID`, dan nama brand melalui
`NOTIFICATION_BRAND_NAME`. Template email bersifat responsif dan dapat dibuka
pada desktop maupun perangkat mobile.

## Send Message API

Endpoint integrasi pihak ketiga:

```http
POST /v1/messages/send
Authorization: Bearer <API_KEY_NWA>
Content-Type: application/json
```

API key harus berupa plaintext key yang diawali `nwa_...`, bukan ID record API key. Plaintext key hanya tampil sekali saat generate di dashboard.

### Kirim Text

```bash
curl -X POST http://localhost:3000/v1/messages/send \
  -H "Authorization: Bearer <API_KEY_NWA>" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "628123456789",
    "type": "text",
    "message": "Pesanan Anda #1234 telah dikirim.",
    "deviceId": "b5d08f67-e7e4-4e1f-a76c-bb6dd2737043"
  }'
```

### Kirim Image

```bash
curl -X POST http://localhost:3000/v1/messages/send \
  -H "Authorization: Bearer <API_KEY_NWA>" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "628123456789",
    "type": "image",
    "mediaUrl": "https://example.com/invoice-1234.jpg",
    "caption": "Invoice #1234",
    "deviceId": "b5d08f67-e7e4-4e1f-a76c-bb6dd2737043"
  }'
```

Field:

| Field | Wajib | Keterangan |
|---|---:|---|
| `to` | Ya | Nomor tujuan format internasional tanpa `+`, contoh `628123456789` |
| `type` | Ya | `text`, `image`, atau `document` |
| `message` | Untuk `text` | Isi pesan text, maksimal 4096 karakter |
| `mediaUrl` | Untuk `image` | URL publik file gambar. WA Connector akan download dan upload ke WhatsApp |
| `caption` | Tidak | Caption untuk gambar, maksimal 1024 karakter |
| `deviceId` | Wajib jika API key account-wide | Device pengirim. Diabaikan jika API key sudah di-scope ke device tertentu |

Catatan `image`:

- `mediaUrl` harus bisa diakses oleh backend/WA Connector.
- Konten harus bertipe `image/*`.
- Ukuran maksimal gambar di WA Connector saat ini 15 MB.
- Response sukses awal adalah `{"status":"queued"}`; status final bisa dilihat di log pengiriman.

## Groups & Scrape Kontak Grup API

Endpoint integrasi pihak ketiga untuk menarik data grup WhatsApp yang diikuti
sebuah device. Sama seperti Send Message, pakai API key (`nwa_...`) di header.
Semua parameter dikirim di **body JSON** (POST). `deviceId` wajib untuk API key
account-wide; diabaikan jika key sudah di-scope ke device tertentu. Scrape
**tidak mengurangi kuota pesan**, hanya dibatasi rate-limit per detik sesuai paket.

### Daftar Grup

```http
POST /v1/groups
Authorization: Bearer <API_KEY_NWA>
Content-Type: application/json
```

```bash
curl -X POST http://localhost:3000/v1/groups \
  -H "Authorization: Bearer <API_KEY_NWA>" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"b5d08f67-e7e4-4e1f-a76c-bb6dd2737043"}'
```

Response:

```json
{
  "groups": [
    { "jid": "120363xxx@g.us", "name": "Tim Internal", "participantCount": 42 }
  ]
}
```

### Scrape Anggota Grup

```http
POST /v1/groups/members
Authorization: Bearer <API_KEY_NWA>
Content-Type: application/json
```

`groupJid` didapat dari field `jid` di response daftar grup (format `<numeric>@g.us`).
Hasil dikembalikan **langsung di response** (sync) dan juga dipush via webhook
`group.members` bila terdaftar (best-effort).

```bash
curl -X POST http://localhost:3000/v1/groups/members \
  -H "Authorization: Bearer <API_KEY_NWA>" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId":"b5d08f67-e7e4-4e1f-a76c-bb6dd2737043",
    "groupJid":"120363012345678901@g.us"
  }'
```

Response:

```json
{
  "groupId": "120363012345678901@g.us",
  "groupName": "Tim Internal",
  "participantCount": 2,
  "participants": [
    { "phone": "628123456789", "jid": "628123456789@s.whatsapp.net", "lid": "", "isAdmin": false, "isSuperAdmin": false, "displayName": "" },
    { "phone": "", "jid": "265205858734081:0@lid", "lid": "265205858734081:0@lid", "isAdmin": true, "isSuperAdmin": false, "displayName": "" }
  ]
}
```

Catatan:

- `phone` kosong (`""`) berarti peserta hanya punya LID (mis. grup incognito / mode LID WhatsApp); `jid`/`lid` tetap disertakan agar kontak tidak hilang.
- Device harus berstatus `connected`; jika tidak → 400. Bukan anggota grup / JID invalid → 400/404.

## Webhook `group.members` (Scrape Kontak)

Buat webhook dengan `eventType`:

```json
{
  "url": "https://yourapp.com/webhooks/neowa",
  "eventType": "group.members"
}
```

Saat endpoint `/v1/groups/members` dipanggil, payload yang sama dengan
response dikirim ke semua webhook aktif `group.members` (best-effort, ditandatangani
HMAC-SHA256 di header `X-Signature`, tercatat di `WebhookLog`):

```json
{
  "event": "group.members",
  "data": {
    "deviceId": "b5d08f67-e7e4-4e1f-a76c-bb6dd2737043",
    "groupId": "120363012345678901@g.us",
    "groupName": "Tim Internal",
    "participantCount": 2,
    "participants": [ { "phone": "628123456789", "jid": "...", "lid": "", "isAdmin": false, "isSuperAdmin": false, "displayName": "" } ]
  },
  "timestamp": "2026-08-07T03:00:00.000Z"
}
```

## Webhook Pesan Masuk

Buat webhook dengan `eventType`:

```json
{
  "url": "https://yourapp.com/webhooks/neowa",
  "eventType": "message.incoming"
}
```

Saat device menerima chat masuk, backend akan mengirim payload:

```json
{
  "event": "message.incoming",
  "data": {
    "deviceId": "b5d08f67-e7e4-4e1f-a76c-bb6dd2737043",
    "messageId": "ABC123",
    "from": "628123456789",
    "chat": "628123456789",
    "isGroup": false,
    "fromMe": false,
    "pushName": "Nama Pengirim",
    "type": "text",
    "message": "Halo",
    "timestamp": "2026-07-20T09:00:00+07:00"
  },
  "timestamp": "2026-07-20T02:00:00.000Z"
}
```

Untuk chat grup, `from` adalah nomor pengirim dan `chat` adalah ID grup. Untuk pesan media masuk, payload mengirim `type` dan `caption` jika tersedia.

### Media pesan personal (opsional, Cloudflare R2)

Bila fitur R2 diaktifkan di WA Connector (env `R2_*`), media dari **pesan
personal (bukan grup)** otomatis di-download dan di-upload ke bucket R2. URL
publiknya muncul di field `mediaUrl`:

```json
{
  "event": "message.incoming",
  "data": {
    "deviceId": "b5d08f67-e7e4-4e1f-a76c-bb6dd2737043",
    "messageId": "ABC123",
    "from": "628123456789",
    "chat": "628123456789",
    "isGroup": false,
    "type": "image",
    "caption": "Lihat ini",
    "mediaUrl": "https://media.notifpod.my.id/wa-media/202608/<uuid>.jpg",
    "timestamp": "2026-08-07T09:00:00+07:00"
  },
  "timestamp": "2026-08-07T02:00:00.000Z"
}
```

Catatan:

- `mediaUrl` **hanya muncul untuk pesan personal** (`isGroup: false`) yang mengandung media. Pesan grup tidak di-download.
- Bila R2 disabled (env kosong) atau download/upload gagal, `mediaUrl` tidak ada — payload tetap terkirim dengan `type`/`caption`.
- Media dihapus otomatis setelah 30 hari via Lifecycle Rule R2 → URL akan mati setelah itu. Penerima webhook yang butuh file permanen wajib simpan sendiri.

## WA Connector Service

Lihat [wa-connector/README.md](../wa-connector/README.md) untuk microservice Go + whatsmeow yang harus berjalan di lokal port 8080 (atau sesuaikan `WA_CONNECTOR_URL` di `.env`).
