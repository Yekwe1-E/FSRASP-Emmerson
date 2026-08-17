# Data Flow Diagrams (DFD)
## Faculty of Science Academic Repository and Assessment Portal (FSARAP)

---

## 1. Context Diagram (Level 0 DFD)

The Context Diagram illustrates the external entities interacting with the FSARAP system boundary:

```
                  +-----------------------+
                  |       STUDENT         |
                  +-----------------------+
                    |                   ^
      1. Login      |                   | 4. Download Materials &
      2. Take Quiz  v                   |    View Quiz Results
                  +-----------------------+
                  |                       |
                  |     FSARAP SYSTEM     |
                  | (Repository & Quiz)   |
                  |                       |
                  +-----------------------+
                    ^                   |
      3. Upload     |                   | 6. Download Metrics &
         Materials  |                   |    Quiz Analytics
      5. Add Quizzes|                   v
                  +-----------------------+
                  |       LECTURER        |
                  +-----------------------+
```

---

## 2. DFD Level 1: System Decomposition

```
[Student / Lecturer / Admin] 
         |
         v
(Process 1.0: User Auth & Token Verification) ---> [DB: users]
         |
         +---> (Process 2.0: Material Upload & Storage) 
         |              |---> [Supabase Storage Bucket]
         |              +---> [DB: materials]
         |
         +---> (Process 3.0: Material Search & Download Engine)
         |              |---> [DB: materials & downloads]
         |
         +---> (Process 4.0: Assessment Engine & Auto-Grading)
                        |---> [DB: quizzes, questions, options]
                        +---> [DB: quiz_attempts & quiz_answers]
```

---

## 3. DFD Level 2: Detailed Processes

### Process 2.0: Material Upload Sequence
1. Lecturer submits material form with attached document payload.
2. `Multer` middleware validates file size (<= 100MB) and MIME format.
3. Storage handler uploads binary stream to Supabase Storage bucket under `${dept_code}/${level_code}L/`.
4. PostgreSQL saves record entry in `materials` table.
5. System inserts audit record into `audit_logs` table.

### Process 4.0: Assessment & Instant Grading Sequence
1. Student clicks "Take Quiz"; system initializes attempt record in `quiz_attempts`.
2. Questions are served to student UI with `is_correct` answers hidden.
3. Interactive client countdown timer executes.
4. Upon submit or timer expiry, answers array is POSTed to `/api/quizzes/:id/submit`.
5. Backend compares submitted option IDs against correct option keys in `quiz_options`.
6. Total score, percentage, and pass/fail boolean status are updated in `quiz_attempts`.
7. Score breakdown and explanations are returned to student UI.
