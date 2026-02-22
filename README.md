# Murugan Stores Platform

Retail back-office platform for Murugan Stores covering store management, billing, inventory, purchases, supplier relations, credits, dashboards, and user access control. The repo is a monorepo with a Vite/React frontend (`frontend/`) and an Express + MySQL backend (`backend/`).

> Built with React 18, Tailwind + shadcn/ui, React Query, and a hardened Express API backed by MySQL + Sequelize. The project already supports multistore workflows (store selector, store-scoped dashboards, supplier + inventory filtering).

---

## ✨ Features

- **Modern Dashboard** – Realtime store metrics, low-stock alerts, supplier + item totals with per-store logic.
- **Store-aware Workflows** – Select store context once; Items, Suppliers, Purchases, Billing all respect that context.
- **Billing & POS Tools** – Billing screen with customer credits, barcode lookup, receipt printing (via `components/BillModal` & `BarcodeLabel`).
- **Inventory & Procurement** – Items, Purchase Orders, Suppliers, Appliances integration (legacy `appliance` table support).
- **Credits & Customer Mgmt** – Track credits/settlements per customer with dedicated API set.
- **User & Access Control** – Auth, profile management, screen-based permissions & admin tooling.
- **Operational Extras** – Health/metrics endpoints, QR/Barcode utilities, nodemailer integration, CSV import helpers.

---

## 🧱 Project Structure

```
├── backend/                     # Express + MySQL API
│   ├── controllers/             # Route handlers (auth, dashboard, items, suppliers, etc.)
│   ├── routes/                  # API route definitions
│   ├── models/                  # Sequelize models (Store, Bill, Supplier, Screen…)
│   ├── repositories/            # Raw SQL/data helpers (items, appliances, supplier-store, etc.)
│   ├── services/                # Background services (screens initializer, emails)
│   ├── db/                      # MySQL connection + Sequelize bootstrapping
│   └── server.js                # Express app entry (security, compression, routes, health)
│
├── frontend/                    # Vite + React + shadcn UI
│   ├── src/pages/               # Major screens (Dashboard, Billing, Items, Suppliers, Reports, ...)
│   ├── src/components/          # Shared UI widgets (MetricCard, modals, sidebar, navbar, etc.)
│   ├── src/contexts/AuthContext # Auth/session/store context & helper hooks
│   ├── src/services/api.js      # API client (token handling, typed endpoints)
│   └── src/constants/           # Screen permissions, static data
└── README.md
```

---

## 🧰 Tech Stack

| Layer    | Technology                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Frontend | React 18, Vite 5, TailwindCSS, shadcn/ui, React Router, React Query, Lucide icons, Recharts, React Hook Form + Zod |
| Backend  | Node.js 18+, Express 4, Sequelize, mysql2, multer, nodemailer, helmet, compression, rate-limit, JWT                |
| Database | MySQL 8+ (`Super_Market` schema, incl. legacy `appliance`, `Products`, `Suppliers`, `Bills`, etc.)                 |
| Tooling  | pnpm, eslint, nodemon, dotenv                                                                                      |

---

## ⚙️ Prerequisites

- Node.js **18+**
- pnpm **8+** (or npm/yarn, but scripts documented with pnpm)
- MySQL **8+** (or compatible 5.7+) running locally or remotely
- Access to SMTP credentials if email notifications are desired

---

## 🔐 Environment Variables

Create a `.env` in the project root (backend reads it automatically). Minimum variables:

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173
MYSQL_URL=mysql://root:password@localhost:3306/Super_Market
JWT_SECRET=super-secret-string
JWT_EXPIRE=24h
BCRYPT_ROUNDS=10
EMAIL_USER=your@gmail.com
EMAIL_PASS=app-password
```

Frontend expects a `.env` file inside `frontend/`:

```env
VITE_BACKEND_URL=http://localhost:5000
```

> Tip: For multistore dashboards make sure the DB contains the `appliance`, `Products`, `Suppliers`, and `stores` tables with proper `store_id` associations.

---

## 🚀 Getting Started

### 1. Clone & install

```bash
git clone https://github.com/your-org/murugan-stores.git
cd murugan-stores

# Install backend deps
cd backend
pnpm install

# Install frontend deps
cd ../frontend
pnpm install
```

### 2. Prepare MySQL

```sql
CREATE DATABASE IF NOT EXISTS Super_Market;
```

Ensure `MYSQL_URL` in `.env` points to this DB. The backend will auto-create missing schema pieces (users screen_id/index, etc.) when it boots.

### 3. Run backend

```bash
cd backend
pnpm dev   # or pnpm start for production
```

The API runs at `http://localhost:5000` by default. Visit `/api/health` to verify.

### 4. Run frontend

```bash
cd frontend
pnpm dev
```

The app lives at `http://localhost:5173` and proxies API calls to the backend URL configured in `VITE_BACKEND_URL`.

---

## 🗂️ Key Scripts

| Location | Command                   | Description                              |
| -------- | ------------------------- | ---------------------------------------- |
| backend  | `pnpm dev`                | Start Express backend with nodemon       |
| backend  | `pnpm start`              | Start backend once (production)          |
| backend  | `pnpm migrate-schema`     | Custom script to align schema with MySQL |
| backend  | `pnpm migrate-equipments` | Legacy migration for equipment table     |
| frontend | `pnpm dev`                | Vite dev server                          |
| frontend | `pnpm build`              | Production build (outputs to `dist/`)    |
| frontend | `pnpm lint`               | Run eslint config                        |

---

## 📡 Notable API Endpoints

| Method | Path                             | Description                                           |
| ------ | -------------------------------- | ----------------------------------------------------- |
| `POST` | `/api/auth/login`                | Authenticate user and issue JWT                       |
| `GET`  | `/api/dashboard/stats`           | Store-scoped metrics (sales, customers, trends…)      |
| `GET`  | `/api/dashboard/items/total`     | Store-aware total items count (appliance vs products) |
| `GET`  | `/api/dashboard/suppliers/total` | Overall supplier total                                |
| `GET`  | `/api/items`                     | Items listing (store aware + legacy overrides)        |
| `GET`  | `/api/purchase-orders`           | Purchase order workflows                              |
| `GET`  | `/api/credits`                   | Credit management                                     |
| `GET`  | `/api/health`                    | Service health check                                  |

> Full routes live under `backend/routes/`.

---

## 🧭 Frontend Highlights

- **AuthContext** centralizes JWT handling, user profile, and selected store.
- **ProtectedRoute/PublicRoute** guard screens based on auth + store selection.
- **Dashboard** automatically refreshes metrics every 30 seconds and keeps supplier/items counts in sync with dedicated APIs.
- **DataTable + shadcn components** provide consistent UI/UX for tables, forms, modals.
- **React Query** (TanStack) is available for data fetching patterns beyond the raw API wrapper.

---

## ✅ Development Checklist

- [ ] Configure `.env` & `.env.local` endpoints
- [ ] Seed base stores & assign store access to users
- [ ] Verify `/api/health` & `/api/metrics`
- [ ] Confirm store selection works (Select Store screen) before hitting dashboard
- [ ] Enable email services by configuring `EMAIL_USER/PASS` if OTP/reset flows are needed

---

## 📦 Production Notes

- Serve frontend build (e.g., Netlify/Vercel/S3) and point it to your backend URL via `VITE_BACKEND_URL`.
- Behind a reverse proxy, forward `/api` requests to the Express server while letting static assets resolve from Vite build output.
- Set `NODE_ENV=production`, `JWT_SECRET` to a long random value, and configure HTTPS (CORS already respects origin).

---

## 🤝 Contributing

1. Fork & create a feature branch.
2. Make changes with linting (`pnpm lint`) and formatting.
3. Add/update documentation/tests when relevant.
4. Submit a PR describing the feature/fix; include screenshots for UI updates if possible.

---

## 📝 License

This project is licensed under the [MIT License](./LICENSE). Feel free to adapt and deploy for your retail workflows.

---

## 🔧 Jenkins Pipeline Troubleshooting

### Git Not Available Error

If you see errors like `Cannot run program "git"` or `Failed to exec spawn helper`, Git is not installed or not accessible on your Jenkins node.

**Solution:**

1. SSH into your Jenkins agent/node
2. Install Git:

   ```bash
   # Ubuntu/Debian
   sudo apt-get update && sudo apt-get install -y git

   # RHEL/CentOS
   sudo yum install -y git
   ```

3. Verify installation:
   ```bash
   git --version
   which git
   ```
4. Ensure Git is in PATH for the Jenkins user
5. Restart Jenkins service if needed:
   ```bash
   sudo systemctl restart jenkins
   ```

### Other Common Issues

- **Docker not found**: Install Docker on the Jenkins node and ensure the Jenkins user has permission to use it
- **Permission denied**: Check workspace directory permissions (`/var/lib/jenkins/workspace/`)
- **Network issues**: Verify Jenkins can reach GitHub and GHCR (ghcr.io)
- **Credentials**: Ensure GitHub PAT and Docker registry credentials are properly configured in Jenkins

---

**Need help?** Ping the maintainers via Issues or reach out at `pushdiggy@gmail.com`.
