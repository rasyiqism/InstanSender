# WA Connector Service

Microservice Go + [whatsmeow](https://github.com/tulir/whatsmeow) yang menangani koneksi WhatsApp per device dan pengiriman pesan aktual.

## Setup

```bash
cd wa-connector
go mod tidy
go run .
```

Atau build binary production:

```bash
go build -o wa-connector
./wa-connector
```

## Environment Variables

| Variable | Default | Deskripsi |
|---|---|---|
| `PORT` | `8080` | Port internal HTTP |
| `INTERNAL_TOKEN` | `internal-shared-secret` | Bearer token untuk autentikasi dari backend utama |
| `SESSION_DB` | `wa-sessions.db` | Path SQLite penyimpanan session |
| `BACKEND_URL` | `http://127.0.0.1:3000` | URL backend utama, untuk push status device dan pesan masuk |

### Media Upload ke Cloudflare R2 (opsional)

Saat diaktifkan, media dari **pesan personal (bukan grup)** di-download dan
di-upload ke bucket Cloudflare R2; URL publiknya disertakan di payload webhook
`message.incoming` (field `mediaUrl`). Semua env di bawah opsional — kosong =
fitur mati, connector jalan normal.

| Variable | Default | Deskripsi |
|---|---|---|
| `R2_BUCKET` | _(kosong)_ | Nama bucket R2 |
| `R2_ENDPOINT` | _(kosong)_ | Endpoint S3 R2, mis. `https://<accountid>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_BASE_URL` | _(kosong)_ | Base URL publik object, mis. `https://media.notifpod.my.id` atau `https://pub-xxx.r2.dev` |
| `R2_ACCESS_KEY_ID` | _(kosong)_ | Access key token R2 (R2 → Manage R2 API Tokens) |
| `R2_SECRET_ACCESS_KEY` | _(kosong)_ | Secret token R2 |

**Setup R2:**

1. Buat bucket di Cloudflare R2.
2. Aktifkan public access: tambahkan custom domain (mis. `media.notifpod.my.id`) atau aktifkan `r2.dev` subdomain.
3. Buat API token: R2 → **Manage R2 API Tokens** → permission **Object Read & Write**. Catat Access Key ID + Secret.
4. Set **Lifecycle Rule** untuk auto-delete: bucket → **Settings → Object Lifecycle Rules** → "Delete objects after 30 days". Ini yang menghapus media otomatis — tidak ada kode/cron di backend.
5. Isi `R2_*` di env connector, restart.

> Catatan: URL `mediaUrl` akan mati setelah 30 hari (object dihapus oleh lifecycle rule). Penerima webhook yang butuh file permanen wajib simpan sendiri.

## Internal Endpoints

| Method | Path | Deskripsi |
|---|---|---|
| `POST` | `/internal/wa/device/:id/session` | Buat sesi baru, mulai koneksi & generate QR |
| `GET` | `/internal/wa/device/:id/qr` | Ambil QR saat ini + status |
| `GET` | `/internal/wa/device/:id/status` | Status koneksi + nomor telepon |
| `DELETE` | `/internal/wa/device/:id/session` | Hapus sesi & logout |
| `POST` | `/internal/wa/send` | Kirim pesan ke nomor tujuan |
| `GET` | `/internal/wa/groups?deviceId=<id>` | Daftar grup yang diikuti device (jid, nama, jumlah anggota) |
| `GET` | `/internal/wa/group/members?deviceId=<id>&jid=<groupJid>` | Daftar anggota sebuah grup (nomor, jid, admin) |

### Groups & Members

```bash
# daftar grup
curl http://127.0.0.1:8080/internal/wa/groups?deviceId=uuid \
  -H "Authorization: Bearer internal-shared-secret"
# → {"groups":[{"jid":"120363xxx@g.us","name":"Tim","participantCount":42}]}

# daftar anggota sebuah grup (jid grup via query param ?jid=)
curl "http://127.0.0.1:8080/internal/wa/group/members?deviceId=uuid&jid=120363xxx@g.us" \
  -H "Authorization: Bearer internal-shared-secret"
# → {"groupId":"120363xxx@g.us","groupName":"Tim","participantCount":2,
#    "participants":[
#      {"phone":"628123456789","jid":"628123456789@s.whatsapp.net","lid":"","isAdmin":false,"isSuperAdmin":false,"displayName":""},
#      {"phone":"","jid":"265205858734081:0@lid","lid":"265205858734081:0@lid","isAdmin":true,"isSuperAdmin":false,"displayName":""}
#    ]}
```

Catatan:

- `phone` kosong (`""`) berarti peserta hanya punya LID (mis. grup incognito / mode LID); `jid`/`lid` tetap disertakan agar kontak tidak hilang.
- `jid` grup diteruskan via query param `?jid=` agar aman dari encoding karakter `@`.


## Contoh Request dari Backend Utama

### Text

```bash
curl -X POST http://127.0.0.1:8080/internal/wa/send \
  -H "Authorization: Bearer internal-shared-secret" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"uuid","to":"628123456789","type":"text","message":"Halo"}'
```

### Image

```bash
curl -X POST http://127.0.0.1:8080/internal/wa/send \
  -H "Authorization: Bearer internal-shared-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "uuid",
    "to": "628123456789",
    "type": "image",
    "mediaUrl": "https://example.com/invoice-1234.jpg",
    "caption": "Invoice #1234"
  }'
```

Field image:

| Field | Wajib | Keterangan |
|---|---:|---|
| `deviceId` | Ya | ID device pengirim dari backend utama |
| `to` | Ya | Nomor tujuan format internasional tanpa `+` |
| `type` | Ya | Gunakan `image` |
| `mediaUrl` | Ya | URL publik gambar yang akan di-download connector |
| `caption` | Tidak | Caption gambar |

Catatan:

- Connector menolak `mediaUrl` kosong atau konten non-image.
- Ukuran gambar maksimal 15 MB.
- Format image umum mengikuti hasil `Content-Type`/deteksi file dari URL.
- Session WhatsApp yang sudah tersimpan di `SESSION_DB` akan dicoba restore otomatis saat send jika proses connector baru restart.
- Pesan masuk dari WhatsApp dikirim ke backend internal endpoint `/devices/internal/incoming`, lalu backend meneruskan ke webhook user dengan event `message.incoming`.
- `document` belum diimplementasikan.

## Integrasi aaPanel

1. Build binary di VPS:

```bash
go build -o wa-connector
```

2. Jalankan sebagai systemd/supervisor service di port 8080 (bind localhost).
3. Pastikan backend utama dapat mengakses `WA_CONNECTOR_URL=http://127.0.0.1:8080`.
