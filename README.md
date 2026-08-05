# Sweet Home 🏠

A shared-home management dashboard for **9 housemates** — built with the **MERN stack** (MongoDB, Express, React, Node.js).

Sweet Home tracks the monthly pooled collection (₹6,000 each), daily household expenses, the remaining balance, and the weekly chore rotation — all in a mobile-first, installable **PWA**. No login wall: everyone can view, write actions require a 4-digit PIN verified on the backend.

---

## Features

| Area | What it does |
| --- | --- |
| **Dashboard** | Available balance, collection progress, paid/pending counts, today's duties, recent expenses |
| **Collection** | ₹6,000 × 9 target, deadline countdown (5th of the month), per-member paid/pending grid, mark-as-paid with PIN, admin corrections + monthly reset |
| **Expenses** | Add/edit/delete expenses (admin), categories, paid-by, live balance, scrollable ledger |
| **Chores** | Today's duties auto-detected, weekly timetable, admin swap/edit, restore-default, schedule validation (2/2/1/4) |
| **Admin** | Admin Mode (Gowtham / Harish), user + PIN management, monthly history, audit log |

### Business rules enforced on the backend

- 9 housemates, ₹6,000/person, ₹54,000/month target, deadline = 5th.
- Daily chores: 2 cooking, 2 cleaning, 1 home clean, 4 resting (resting is derived).
- Members can only mark **their own** contribution paid and only record expenses they actually paid for.
- Admins (Gowtham, Harish) can do everything.
- All write routes require a valid short-lived token issued after PIN verification.
- PINs are stored as **bcrypt hashes only** and never returned by the API.
- `totalCollected`, `totalSpent` and `balance` are always **computed server-side**.
- Duplicate monthly payments are prevented.
- Monthly funding rolls over automatically on the 1st (Asia/Kolkata) via a CRON job — previous months are kept.

---

## Tech stack

- **Server**: Node.js, Express, Mongoose, JSON Web Tokens, bcryptjs, express-rate-limit, node-cron, morgan
- **Client**: React 18, React Router 6, Vite, Axios, lucide-react
- **PWA**: Web app manifest, generated icons, service worker

---

## Project structure

```
homehq/
├── package.json            # root scripts (concurrently)
├── .env.example
├── README.md
├── server/
│   ├── app.js              # express app (exported for tests)
│   ├── index.js            # bootstrap: db + seed + cron + listen
│   ├── config/             # env config + mongoose connection
│   ├── controllers/        # route handlers
│   ├── middleware/         # auth (JWT), RBAC, rate-limit, error handler
│   ├── models/             # User, FundingCycle, Expense, ChoreSchedule, AuditLog
│   ├── routes/             # REST endpoints
│   ├── services/           # funding, expenses, chores, audit business logic
│   ├── jobs/               # monthly rollover CRON
│   ├── utils/              # time (Asia/Kolkata), constants, errors
│   ├── seed/               # idempotent seed (users, cycle, chores)
│   ├── scripts/            # run.js (launcher), stop.js (shutdown)
│   └── smoke-test.js       # 33-assertion API test (in-memory MongoDB)
└── client/
    ├── public/             # manifest.json, sw.js, generated icons
    └── src/
        ├── components/     # bottom sheets, PIN modal, cards, forms…
        ├── pages/          # Dashboard, Collection, Expenses, Chores, Admin
        ├── context/        # App data, Auth (admin session), Toasts
        ├── services/       # axios API layer
        ├── utils/          # IST formatting helpers
        ├── constants/
        └── styles/         # mobile-first design system
```

---

## Prerequisites

- **Node.js 18+** (tested on 22)
- **MongoDB** — not required if you use `Start-HomeHQ.bat` (it launches an embedded MongoDB automatically). For manual `npm` commands you need a local install, or a free Atlas cluster (MongoDB Atlas M0). Set `MONGODB_URI` accordingly.

> No MongoDB? You can still run the automated API test — it spins up an in-memory MongoDB automatically (`npm test`).

---

## Setup

```bash
# 1. Install dependencies (root, server, client)
npm run install-all

# 2. Configure environment
cp .env.example server/.env
# edit server/.env — set MONGODB_URI, JWT_SECRET and your SEED_PINS

# 3. Seed the database (users, current funding cycle, default chore schedule)
npm run seed

# 4. Run everything in dev mode
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:5000

To run them separately:

```bash
npm run server     # Express on :5000
npm run client     # Vite on :5173 (proxies /api -> :5000)
```

### Production build

```bash
npm run build      # vite build -> client/dist
npm start          # Express serves client/dist + API on :5000
```

---

## One-click launch (Windows — no MongoDB install needed)

Double-click **`Start-HomeHQ.bat`** and everything starts automatically in one window:

- An **embedded MongoDB** (downloaded once via `mongodb-memory-server`, cached under `%USERPROFILE%\.cache\mongodb-binaries`) with a **persistent data folder** at `data/db` — your data survives restarts.
- The **API server** on `:5000` and the **Vite dev client** on `:5173`.
- Your browser opens to `http://localhost:5173/dashboard`.
- Press **Ctrl+C** in the window, or double-click **`Stop-HomeHQ.bat`**, to shut everything down (data is kept).

Optional argument: `Start-HomeHQ.bat prod` builds the client and serves it from Express on `:5000` instead of Vite.

> First run installs npm dependencies if missing (root/server/client). Requires **Node.js 18+** on PATH.

---

## Initial accounts

Seeded users (PINs come from `SEED_PINS` / `SEED_DEFAULT_PIN` in `server/.env`):

| Name | Role |
| --- | --- |
| Veera | member |
| Harish | **admin** |
| Gowtham | **admin** |
| Ashwin | member |
| Jegan | member |
| Dhanesh | member |
| Bhuvanesh | member |
| Akash | member |
| Bala | member |

Default dev PINs are `1234` for everyone (from `.env`) — **change them before real use** via Admin Mode → User Management, or re-seed with `npm run seed:force` after updating `SEED_PINS`.

---

## API overview

| Method | Endpoint | Auth |
| --- | --- | --- |
| POST | `/api/auth/verify-pin` | rate-limited (20/15min) |
| GET | `/api/users` | public |
| PATCH | `/api/users/:id/pin` | admin |
| PATCH | `/api/users/:id` | admin |
| GET | `/api/funding/current` | public |
| GET | `/api/funding/history` | public |
| POST | `/api/funding/:userId/pay` | member (self) / admin |
| PATCH | `/api/funding/:userId/status` | admin |
| POST | `/api/funding/reset` | admin |
| GET | `/api/expenses` | public |
| GET | `/api/expenses/current-month` | public |
| POST | `/api/expenses` | verified (paid-by rule enforced) |
| PATCH | `/api/expenses/:id` | admin |
| DELETE | `/api/expenses/:id` | admin |
| GET | `/api/chores` | public |
| GET | `/api/chores/today` | public |
| PATCH | `/api/chores/:day` | admin |
| POST | `/api/chores/swap` | admin |
| POST | `/api/chores/restore-default` | admin |
| GET | `/api/admin/audit-logs` | admin |

Write routes take `Authorization: Bearer <token>` where the token comes from `POST /api/auth/verify-pin`. Tokens are short-lived (`TOKEN_TTL`, default 15 minutes). Admin sessions automatically expire.

---

## How the PIN flow works

1. Everyone can read the dashboard without any login.
2. To do a write action, the app shows a bottom sheet: pick your name → enter your 4-digit PIN.
3. The PIN goes to `POST /api/auth/verify-pin`; the server bcrypt-compares it and issues a short-lived JWT (expires in `TOKEN_TTL`).
4. The write request is then sent with that JWT; the server re-loads the user from the DB and re-checks **role + permission** on every request — frontend role checks are never trusted.
5. Admins who unlock **Admin Mode** keep their token for the session (15 min) so they aren't re-prompted; members are prompted per action.

---

## Automation

`server/jobs/monthlyReset.js` runs on the **1st of every month at 00:00 Asia/Kolkata** and creates the new funding cycle (all 9 payments pending, ₹0 collected). The endpoint `POST /api/funding/reset` lets an admin reset the current month manually.

---

## Testing

```bash
npm run test --prefix server
```

The smoke test boots an in-memory MongoDB, seeds HomeHQ, and runs 33 assertions across PIN verification, RBAC, funding, expenses, chore swapping/validation, audit logs, and PIN changes.

---

## PWA

HomeHQ is installable:

- `client/public/manifest.json` — name, theme, icons, standalone display
- `client/public/sw.js` — service worker (cache-first static, network-first API)
- Generated icons: `client/public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`

Install from the browser menu (Add to Home Screen / Install App).

---

## Environment variables (`server/.env`)

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | API port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/homehq` |
| `JWT_SECRET` | Signs identity tokens (set a long random value!) | — |
| `TOKEN_TTL` | Identity/admin token lifetime (seconds) | `900` |
| `CLIENT_ORIGIN` | CORS origin | `http://localhost:5173` |
| `SEED_PINS` | `Name=pin,Name=pin,…` used at seed time | dev defaults |
| `SEED_DEFAULT_PIN` | Fallback PIN for users not in `SEED_PINS` | `1234` |
| `LOG_LEVEL` | morgan level (`dev`, `combined`, `none`) | `dev` |
| `HOUSEHOLD_TZ` | Household timezone | `Asia/Kolkata` |
| `AUTO_SEED` | Idempotent seed on server boot | `true` |
