# RPD — Fitur Agency Reseller

## 1. Ringkasan

Sistem adalah SaaS WhatsApp Gateway dengan model **Agency Reseller**.

Struktur utama:

```text
ADMIN
    │
    ├── Agency A
    │      ├── User 001
    │      ├── User 002
    │      └── User 003
    │
    ├── Agency B
    │      ├── User 004
    │      └── User 005
    │
    └── Agency C
           └── User 006
```

Agency membeli **Agency Package** dari Admin. Package menentukan:

- Kuota device
- Masa berlaku
- Harga
- Fitur Agency

Setelah aktif, Agency dapat:

- Membuat User baru
- Memilih User Package untuk User
- Melihat daftar User yang dibuat
- Melihat status subscription User
- Melakukan renewal
- Suspend/aktifkan User
- Hapus User

---

# 2. Role

Sistem memiliki 3 role utama:

| Role | Fungsi |
|---|---|
| `ADMIN` | Mengelola seluruh platform |
| `AGENCY` | Reseller yang membuat dan mengelola User |
| `USER` | Pengguna akhir WhatsApp Gateway |

## 2.1 ADMIN

Admin dapat:

- Mengelola Agency
- Membuat Agency Package
- Membuat User Package
- Melihat seluruh User
- Melihat seluruh Device
- Mengelola Subscription
- Mengelola transaksi
- Mengelola WhatsApp Gateway
- Suspend Agency
- Suspend User
- Melihat analytics platform

## 2.2 AGENCY

Agency dapat:

- Register sebagai Agency
- Membeli Agency Package
- Melihat subscription Agency
- Melihat quota device
- Membuat User
- Memilih User Package
- Melihat User yang dibuat
- Mengelola User
- Renew User
- Suspend User
- Melihat device User
- Melihat transaksi

---

# 3. Agency Registration

Agency dapat mendaftar melalui:

```text
/register-agency
```

Form:

```text
Create Agency Account or exiting user

Name
Email
Phone
Password

Choose Agency Package
```

Contoh package:

```text
Agency Starter
10 Devices
30 Days
Rp299.000

Agency Business
50 Devices
90 Days
Rp999.000

Agency Pro
100 Devices
180 Days
Rp1.799.000

Agency Enterprise
500 Devices
365 Days
Rp4.999.000
```

Flow:

```text
Register Agency
      ↓
Choose Agency Package
      ↓
Payment
      ↓
Payment Success
      ↓
Agency Active
      ↓
Agency Dashboard
```

---

# 4. Agency Package

Agency Package dibuat oleh Admin.

## Field

```text
Package Name
Device Quota
Duration
Price
Features
Status
```

Contoh:

| Package | Device | Masa Aktif | Harga |
|---|---:|---:|---:|
| Agency Starter | 10 | 30 hari | Rp299.000 |
| Agency Business | 50 | 90 hari | Rp999.000 |
| Agency Pro | 100 | 180 hari | Rp1.799.000 |
| Agency Enterprise | 500 | 365 hari | Rp4.999.000 |

## Create Agency Package

```text
Create Agency Package

Package Name
[ Agency Business ]

Device Quota
[ 50 ]

Duration
[ 90 ] [ Days ]

Price
[ Rp999.000 ]

Features

☑ Create Users
☑ Manage Users
☑ WhatsApp Gateway

Status
● Active

[ Save Package ]
```

---

# 5. Agency Subscription

Setelah pembayaran berhasil, Agency mendapatkan subscription.

Contoh:

```text
Agency Subscription

Package
Business

Device Quota
50

Used
12

Available
38

Started
08 August 2026

Expired
06 November 2026

Status
ACTIVE
```

Formula:

```text
Available Device
=
Device Quota - Device Used
```

Contoh:

```text
50 - 12 = 38 Available
```

---

# 6. Agency Dashboard

Dashboard Agency harus menampilkan informasi reseller.

```text
Agency Dashboard

Welcome back, Digital Agency

┌────────────────────┐
│ Total Users        │
│ 24                 │
└────────────────────┘

┌────────────────────┐
│ Devices             │
│ 38 / 50            │
└────────────────────┘

┌────────────────────┐
│ Active Users       │
│ 22                 │
└────────────────────┘

┌────────────────────┐
│ Expired Users      │
│ 2                  │
└────────────────────┘
```

Agency Package:

```text
Business

50 Devices

Used
38

Available
12

Expires
06 November 2026

[ Upgrade Package ]
```

---

# 7. Agency Navigation

```text
Dashboard

Users
├── All Users
└── Create User

Devices
├── All Devices
└── Available Quota

Packages
└── Available Packages

Subscription
└── My Package

Transactions
└── Payment History

Settings
```


Agency hanya dapat memilih package User yang berstatus Active dan tersedia untuk Agency.

---

# 9. Create User

Agency dapat membuat User melalui:

```text
Users → Create User
```

Form:

```text
Create New User

Name
[ Ahmad Store ]

Email
[ ahmad@gmail.com ]

Phone
[ 08123456789 ]

Password
[ ******** ]

Package
[ Business ▼ ]


Agency Quota

Available:
32 Devices

After Create:
29 Devices

[ Create User ]
```

## Validasi

Sistem harus mengecek:

```text
Agency Device Available >= User Device Quota
```

Jika tidak cukup:

```text
Insufficient Device Quota

Available:
2 Devices

Requested:
3 Devices
```

User tidak boleh dibuat.

---

# 10. User List

Agency dapat melihat semua User yang dibuat oleh Agency tersebut.

```text
Users

+ Create User
```

Table:

| User | Package | Devices | Status | Expired | Action |
|---|---|---:|---|---|---|
| Ahmad | Business | 3/3 | Active | 08 Sep 2026 | Manage |
| Budi | Basic | 1/1 | Active | 08 Sep 2026 | Manage |
| Toko ABC | Pro | 5/5 | Active | 06 Nov 2026 | Manage |
| Sinta | Business | 3/3 | Expired | Expired | Manage |

Action:

```text
View
Edit
Devices
Renew
Suspend
Delete
```

---

# 11. User Detail

Contoh:

```text
Ahmad Store

Status
🟢 Active

Package
Business

Devices
3 / 3

Expired
08 September 2026
```

## WhatsApp Devices

```text
Device 01

+62 812 xxx xxx

🟢 Connected

Messages Today
1,284
```

```text
Device 02

+62 813 xxx xxx

🔴 Disconnected
```

---

# 12. Device Quota

Device quota adalah resource utama Agency.

Contoh Agency:

```text
Agency Package
Business

Total Device
50
```

User:

```text
Ahmad
3 Devices

Budi
5 Devices

Sinta
2 Devices
```

Maka:

```text
Total
50

Used
10

Available
40
```

Jika Agency membuat User dengan quota 45:

```text
Available:
40

Requested:
45
```

Sistem menolak.


# 14. Masa Berlaku Agency

Agency memiliki:

```text
starts_at
expires_at
status
```

Status:

```text
TRIAL
ACTIVE
EXPIRED
SUSPENDED
CANCELLED
```

Flow:

```text
TRIAL
  ↓
ACTIVE
  ↓
EXPIRED
  ↓
RENEW
  ↓
ACTIVE
```

Jika Agency expired:

```text
Create User      ❌
Add Device       ❌
Upgrade          ✓
Renew            ✓
View Dashboard   ✓
View Users       ✓
```

User yang sudah aktif tidak otomatis dihapus.

User tetap mengikuti subscription User masing-masing.

---

# 15. User Subscription

Setiap User memiliki subscription sendiri.

Contoh:

```text
User Subscription

User
Ahmad Store

Package
Business

Devices
3

Started
08 August 2026

Expires
07 September 2026

Status
ACTIVE
```

Status:

```text
TRIAL
ACTIVE
EXPIRED
SUSPENDED
CANCELLED
```

---

# 16. Renew User

Agency dapat memperpanjang subscription User.

```text
Ahmad Store

Current Package
Business

Expired
08 September 2026

[ Renew ]
```

Renewal:

```text
Renew User

Package
Business

Duration
30 Days

Price
Rp99.000

[ Confirm Renewal ]
```

---

# 17. Suspend User

Agency dapat suspend User.

```text
User
Ahmad Store

Status
ACTIVE

[ Suspend User ]
```

Setelah suspend:

```text
User Login
❌

WhatsApp
❌

API
❌

Inbox
❌
```

Agency tetap dapat:

```text
View User
Renew
Activate
Delete
```

---

# 18. Agency Transaction

Agency dapat melihat transaksi.

```text
Transactions

┌────────────┬───────────────┬────────────┬──────────┐
│ Date       │ Description   │ Amount     │ Status   │
├────────────┼───────────────┼────────────┼──────────┤
│ 08 Aug     │ Agency Pro    │ Rp999.000  │ Paid     │
│ 08 Aug     │ User Ahmad    │ Rp99.000   │ Paid     │
│ 07 Aug     │ User Budi     │ Rp49.000   │ Paid     │
└────────────┴───────────────┴────────────┴──────────┘
```

---

# 19. Revenue Agency

Agency dapat melihat revenue jika sistem menggunakan pricing reseller.

Contoh:

```text
Agency Revenue

Total Sales
Rp12.500.000

Platform Cost
Rp7.800.000

Estimated Profit
Rp4.700.000
```

Pricing:

```text
Agency Price
Rp99.000

Retail Price
Rp149.000

Estimated Margin
Rp50.000
```

Agency dapat menentukan harga jual sendiri jika fitur custom pricing diaktifkan oleh Admin.

---

# 20. Admin Dashboard

Admin:

```text
Dashboard

Agencies
248

Active Agencies
221

Users
4,821

Devices
8,421

Active Devices
7,892

Revenue
Rp182.450.000
```

Navigation:

```text
Dashboard

Agencies
Users

Agency Packages
User Packages

Subscriptions

Devices
WhatsApp

Transactions
Payments

Analytics

Settings
```

---

# 21. Admin — Agencies

Table:

| Agency | Package | Devices | Users | Status | Expired |
|---|---|---:|---:|---|---|
| Digital Agency | Business | 38/50 | 24 | Active | 06 Nov |
| ABC Solution | Pro | 82/100 | 48 | Active | 12 Dec |
| XYZ Partner | Starter | 10/10 | 10 | Expired | 01 Aug |

Action:

```text
View
Edit
Suspend
Renew
Change Package
```

---

# 22. Admin — User Management

Admin dapat melihat seluruh User:

```text
Users

Search
Filter Agency
Filter Package
Filter Status
```

Kolom:

```text
User
Agency
Package
Devices
Status
Created
Expired
Action
```

Admin dapat:

```text
View
Edit
Suspend
Activate
Delete
Change Package
```

---

# 23. Multi-Tenant Security

Data harus terisolasi berdasarkan Agency.

Contoh:

```text
Agency A
 ├── User 1
 ├── User 2
 └── User 3

Agency B
 ├── User 4
 └── User 5
```

Agency A:

```text
SELECT users
WHERE agency_id = current_agency_id
```

Agency A tidak boleh dapat mengakses:

```text
User 4
User 5
```

Semua resource penting harus memiliki:

```text
agency_id
```

atau dapat ditelusuri melalui relasi Agency.

---

# 24. Database Structure

## agencies

```text
id
owner_user_id
name
status
created_at
updated_at
```

## users

```text
id
agency_id
role
name
email
phone
password
status
created_at
updated_at
```

## agency_packages

```text
id
name
device_quota
duration_days
price
features
status
created_at
updated_at
```

## agency_subscriptions

```text
id
agency_id
package_id
device_quota
device_used
starts_at
expires_at
status
created_at
updated_at
```

## user_packages

```text
id
name
device_quota
duration_days
price
recommended_retail_price
features
status
created_at
updated_at
```

## user_subscriptions

```text
id
user_id
agency_id
package_id
device_quota
starts_at
expires_at
status
created_at
updated_at
```

## devices

```text
id
agency_id
user_id
phone
device_name
status
connected_at
last_seen_at
created_at
updated_at
```

## transactions

```text
id
agency_id
user_id
type
reference_id
amount
status
payment_method
created_at
updated_at
```

---

# 25. Database Relationship

```text
Agency
  │
  ├── 1:N Users
  │
  ├── 1:1 Agency Subscription
  │
  ├── 1:N Devices
  │
  ├── 1:N Transactions
  │
  └── 1:N User Subscriptions


Agency Package
  │
  └── 1:N Agency Subscriptions


User Package
  │
  └── 1:N User Subscriptions


User
  │
  ├── 1:N Devices
  └── 1:1 User Subscription
```

---

# 26. Complete Business Flow

```text
                    Admin
                         │
                         │
                Create Agency Package
                         │
                         ▼
              50 Devices / 90 Days
                         │
                         ▼
                AGENCY REGISTER
                         │
                         ▼
                      PAYMENT
                         │
                         ▼
                  AGENCY ACTIVE
                         │
                         ▼
                Agency Dashboard
                         │
             ┌───────────┴───────────┐
             │                       │
             ▼                       ▼
        Create User             View Users
             │
             ▼
       Choose User Package
             │
             ▼
          USER ACTIVE
             │
             ▼
       Connect WhatsApp
             │
             ▼
       WhatsApp Gateway
```


# 32. Core Business Rules

## Rule 1 — Agency harus memiliki subscription aktif

```text
Agency.status = ACTIVE
AND
AgencySubscription.status = ACTIVE
AND
expires_at > NOW()
```

Agency dapat membuat User.

## Rule 2 — Device quota harus tersedia

```text
available_devices >= requested_devices
```

## Rule 3 — User harus memiliki package

User tidak dapat aktif tanpa User Subscription.

## Rule 4 — Device harus dimiliki User

Setiap device harus memiliki:

```text
agency_id
user_id
```

## Rule 5 — Agency hanya dapat mengakses User miliknya

```text
user.agency_id === currentAgency.id
```

## Rule 6 — Agency expired

Agency tidak dapat:

```text
Create User
Add Device
Allocate Device
```

Tetapi dapat:

```text
View Users
View Subscription
Renew
Upgrade
```

## Rule 7 — User expired

User tidak dapat menggunakan service WhatsApp:

```text
WhatsApp Gateway = DISABLED
API = DISABLED
Inbox = DISABLED
Campaign = DISABLED
```

User masih dapat login untuk melihat:

```text
Subscription
Renewal
Account
```
