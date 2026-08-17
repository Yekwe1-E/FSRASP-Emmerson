# Software Requirements Specification (SRS)
## Faculty of Science Academic Repository and Assessment Portal (FSARAP)
### Niger Delta University (NDU), Wilberforce Island, Bayelsa State

---

## 1. Introduction

### 1.1 Purpose
This document defines the formal Software Requirements Specification (SRS) for the **Faculty of Science Academic Repository and Assessment Portal (FSARAP)** at Niger Delta University. FSARAP is a web application designed to replace physical file distribution with a centralized digital academic repository and online self-assessment engine.

### 1.2 Scope
FSARAP provides digital storage, categorization, multi-criteria searching, and instant downloading of lecture notes, practical manuals, past questions, and lab guides across all seven (7) academic departments in the Faculty of Science:
1. Department of Computer Science (CSC)
2. Department of Microbiology (MCB)
3. Department of Biochemistry (BCH)
4. Department of Pure and Applied Chemistry (CHM)
5. Department of Physics (PHY)
6. Department of Geology (GLY)
7. Department of Biological Sciences (BIO)

Additionally, FSARAP includes an interactive self-assessment engine where lecturers publish course quizzes and students complete timed tests with instant auto-grading, pass/fail status, and explanation feedback.

---

## 2. Functional Requirements

### 2.1 User Authentication & Authorization (FR-AUTH)
- **FR-AUTH-1**: System shall support registration for Students, Lecturers, Faculty Admins, and Super Admins.
- **FR-AUTH-2**: Students register with standard email validation. Lecturers require administrative approval (`is_approved = false` default) before gaining upload privileges.
- **FR-AUTH-3**: Passwords must be hashed using `Bcrypt` (minimum 10 salt rounds).
- **FR-AUTH-4**: Authentication state is maintained using JSON Web Tokens (JWT) stored in HTTP-Only cookies and Authorization Bearer headers.

### 2.2 Repository & Material Management (FR-REPO)
- **FR-REPO-1**: Lecturers and Admins can upload lecture materials in PDF, DOCX, PPTX, ZIP, PNG, and JPG formats (up to 100MB per file).
- **FR-REPO-2**: Materials are stored in cloud object buckets via Supabase Storage, with fallback local storage streaming.
- **FR-REPO-3**: System provides advanced filtering by Department, Academic Level (100L–500L), Semester, Session, Category, and File Format.
- **FR-REPO-4**: Students can bookmark materials for quick access from their dashboard.
- **FR-REPO-5**: System audits all material downloads and updates real-time download counters via database triggers.

### 2.3 Assessment & Self-Evaluation Engine (FR-QUIZ)
- **FR-QUIZ-1**: Lecturers can create course-bound quizzes with customized duration, pass percentage mark, and maximum allowed attempts.
- **FR-QUIZ-2**: Lecturers can add Multiple Choice (MCQ), True/False, and Short Answer questions with difficulty ratings and detailed explanations.
- **FR-QUIZ-3**: Test execution page features an interactive countdown timer, progress bar, and radio selection controls.
- **FR-QUIZ-4**: When the timer expires, the client automatically submits student responses.
- **FR-QUIZ-5**: Backend performs instant automated grading, calculates percentage score, records attempts, and displays question feedback with explanations.

### 2.4 Role-Based Dashboards (FR-DASH)
- **FR-DASH-1**: Super Admin Dashboard: Global system statistics, pending lecturer approval queue, user activation toggles, and live audit logs stream.
- **FR-DASH-2**: Lecturer Dashboard: Uploaded materials metrics, total student downloads counter, quiz performance statistics, and quick upload triggers.
- **FR-DASH-3**: Student Dashboard: Bookmarked files, quiz attempt history scorecard, average score percentage, and course recommendations.

---

## 3. Non-Functional Requirements

### 3.1 Security (NFR-SEC)
- Security headers enforced via `Helmet`.
- Protection against Cross-Site Scripting (XSS) and Cross-Site Request Forgery (CSRF).
- SQL Injection prevention using parameterized queries (`pg` pool).
- Global API rate limiting (100 requests per 15-minute window per IP).

### 3.2 Performance & Scalability (NFR-PERF)
- Database response time under 200ms for material filter queries.
- Static file serving optimized with browser caching.
- Connection pooling managed via PostgreSQL `Pool`.

### 3.3 Usability & Design (NFR-UI)
- Glassmorphism design system built with CSS custom properties.
- Full responsive layout across Mobile, Tablet, and Desktop displays.
- Dark/Light mode theme switching stored in browser localStorage.
