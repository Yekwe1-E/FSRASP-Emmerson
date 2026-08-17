# REST API Reference Documentation
## Faculty of Science Academic Repository and Assessment Portal (FSARAP)

---

## Base URL
`http://localhost:5000/api`

---

## 1. Authentication Routes (`/auth`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/auth/register` | `POST` | Public | Register new Student or Lecturer account |
| `/auth/login` | `POST` | Public | Authenticate user and issue JWT cookie/token |
| `/auth/me` | `GET` | Authenticated | Retrieve current user profile |
| `/auth/logout` | `POST` | Authenticated | Revoke JWT cookie |
| `/auth/metadata` | `GET` | Public | Fetch departments, levels, semesters, sessions |

---

## 2. Lecture Material Repository Routes (`/materials`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/materials` | `GET` | Public | Search & filter materials with pagination |
| `/materials/:id` | `GET` | Public | Get single material details |
| `/materials/upload` | `POST` | Lecturer/Admin | Upload material file to Supabase Storage |
| `/materials/:id/download` | `POST` | Authenticated | Log material download & get file URL |
| `/materials/:id/bookmark` | `POST` | Authenticated | Toggle material bookmark |
| `/materials/bookmarks` | `GET` | Authenticated | Get student's bookmarked materials |
| `/materials/:id` | `DELETE` | Owner/Admin | Delete material |
| `/materials/:id/approval` | `PUT` | Admin | Approve or reject uploaded material |

---

## 3. Assessment & Quiz Routes (`/quizzes`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/quizzes` | `GET` | Public | List available active quizzes |
| `/quizzes` | `POST` | Lecturer/Admin | Create a new quiz header |
| `/quizzes/:quiz_id/questions` | `POST` | Lecturer/Admin | Add questions & options to quiz |
| `/quizzes/:id/take` | `GET` | Authenticated | Get quiz questions (answers hidden) |
| `/quizzes/:id/start` | `POST` | Authenticated | Start quiz attempt timer |
| `/quizzes/:id/submit` | `POST` | Authenticated | Submit answers for instant auto-grading |
| `/quizzes/attempts/:attempt_id` | `GET` | Authenticated | Get detailed score breakdown & feedback |
| `/quizzes/history` | `GET` | Authenticated | Get student quiz attempt history |

---

## 4. Dashboard Routes (`/dashboard`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/dashboard/admin` | `GET` | Super Admin | System-wide operations and audit stats |
| `/dashboard/faculty` | `GET` | Faculty Admin | Departmental metrics |
| `/dashboard/lecturer` | `GET` | Lecturer | Personal uploads & download analytics |
| `/dashboard/student` | `GET` | Student | Bookmarks, quiz scorecard, recommendations |
| `/dashboard/users/:id/approval` | `PUT` | Admin | Approve/reject lecturer registration |
| `/dashboard/users/:id/active` | `PUT` | Super Admin | Activate/deactivate user account |
