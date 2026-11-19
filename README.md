# InstanSender 🚀

> High-Performance WhatsApp Notification Gateway & Multi-Tenant Agency Reseller SaaS Platform.

Built with **Bun**, **ElysiaJS**, **Drizzle ORM**, and **Vue 3** following the strict engineering blueprint and Anti-Slop UI standards of [`/my-skill`](https://github.com/rasyiqi-code/My-Skill).

---

## 🌟 Tech Stack & Architecture

### **Backend (Fast, Lightweight, Strictly Typed)**
- **Runtime**: [Bun](https://bun.sh) (v1.2+) - ultra-low memory footprint (~30MB idle).
- **Framework**: [ElysiaJS](https://elysiajs.com) - high-throughput HTTP engine with type safety.
- **ORM & Database**: [Drizzle ORM](https://orm.drizzle.team) with PostgreSQL (no runtime overhead, schema-as-code).
- **Background Worker**: [BullMQ](https://docs.bullmq.io) + Redis for staggered broadcast queuing and rate limiting.
- **WhatsApp Engine**: Baileys multi-session connector via HTTP API.

### **Frontend (Tactile, Accessible, Anti-Slop)**
- **Framework**: [Vue 3](https://vuejs.org) (`<script setup lang="ts">`) + Vite.
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com) with semantic layered neutrals and tokenized surfaces.
- **State Management**: [Pinia](https://pinia.vuejs.org).
- **UI Craft**: Swiss Grid hairline aesthetics, horizontal mobile KPI rails, tactile micro-interactions, responsive bottom-sheet dialogs, and `<AppIcon>` inline vector system.

---

## 📁 Monorepo Structure

```text
instansender/
├── frontend/             # Vue 3 + Vite client application
│   ├── src/              # Components, views, stores, composables
│   ├── test/             # Vitest unit & component test suite
│   └── Dockerfile        # Production multi-stage Bun + Nginx container
├── backend/              # Bun + ElysiaJS REST API server
│   ├── src/              # Routes, services, database schemas, queues
│   ├── test/             # Bun test unit & E2E integration test suite
│   └── Dockerfile        # Lightweight alpine Bun container
├── wa-connector/         # Multi-device WhatsApp Baileys service
├── docs/                 # Technical documentation & API references
├── .husky/               # Git pre-commit and pre-push quality gates
├── docker-compose.yml    # Complete production compose specification
├── DOKPLOY.md            # Zero-downtime deployment guide for Dokploy
└── package.json          # Root workspace scripts & quality gates
```

---

## 🛠️ Getting Started Locally

### **Prerequisites**
- [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- [PostgreSQL](https://www.postgresql.org/) (v15+)
- [Redis](https://redis.io/) (v7+)
- [Docker](https://www.docker.com/) (optional, for containerized run)

### **1. Clone & Install Dependencies**
```bash
git clone https://github.com/rasyiqism/InstanSender.git
cd InstanSender
bun install
```

### **2. Setup Environment Variables**
```bash
cp .env.example .env
# Configure your DATABASE_URL, REDIS_URL, and JWT_SECRET
```

### **3. Database Migration & Seed**
```bash
cd backend
bun run drizzle-kit push
bun run seed
```

### **4. Start Development Servers**
```bash
# In separate terminal tabs or using root scripts:
bun run dev:backend    # Runs backend on http://localhost:3000
bun run dev:frontend   # Runs frontend on http://localhost:5173
```

- **Frontend App**: `http://localhost:5173`
- **Backend API**: `http://localhost:3000`
- **Interactive Swagger Docs**: `http://localhost:3000/docs`

---

## 🧪 Testing & Quality Gates

This repository enforces **Zero-Tolerance Quality Gates** via [Husky](https://typicode.github.io/husky/):

```bash
# Run TypeScript compilation checks
bun run typecheck

# Run all tests (Backend Bun test + Frontend Vitest)
bun run test

# Run frontend production build
bun run build
```

- **Pre-commit hook**: Automatically runs `typecheck` and `test`.
- **Pre-push hook**: Automatically runs `typecheck`, `test`, and `build`.

---

## 🚀 Deployment (Dokploy / Docker Compose)

Refer to [DOKPLOY.md](./DOKPLOY.md) for step-by-step production deployment instructions with external database support.

```bash
docker compose up -d --build
```

---

## 📄 License
MIT License.
