# Faculty of Science Academic Repository and Assessment Portal (FSARAP)
### Niger Delta University (NDU)

An end-to-end academic portal for course materials repository and online assessment/self-assessment quizzes, built for Niger Delta University Faculty of Science.

---

## 🌟 Key Features
- **Student Dashboard**: Filter & search materials by department and level (100L - 500L), download lecture notes, take self-assessment quizzes with real-time timers & automated grading.
- **Lecturer Dashboard**: Upload lecture notes, manuals, and past questions directly to Supabase Storage, create quizzes, add MCQ questions, and manage material access.
- **Super Administrator Dashboard**: Approve lecturer upload privileges, view live operational audit logs, activate/deactivate user accounts.
- **Dual Database Architecture**: Hybrid SQLite offline storage with cloud Supabase PostgreSQL synchronization.

---

## 🚀 Quick Start (Local Setup)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `server/.env.example` to `server/.env` and update credentials:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_SUPABASE_REF.supabase.co:5432/postgres
SUPABASE_URL=https://YOUR_SUPABASE_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

### 3. Start Server
```bash
npm start
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 📂 Project Structure
```text
├── client/              # Frontend Web UI (HTML, Vanilla CSS, JS)
├── server/              # Node.js Express API & Supabase Integration
│   ├── config/          # Database & Storage connection configs
│   ├── controllers/     # Route logic (auth, materials, quizzes)
│   ├── middleware/      # Rate limiter, auth tokens, error handler
│   └── routes/          # Express route declarations
├── database/            # Master SQL Schema (schema.sql) & SQLite db
└── docs/                # System documentation & User Manual
```
