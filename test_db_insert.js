const { query } = require('./config/db');
const { randomUUID } = require('crypto');

(async () => {
    const id = 'q-1';
    const studentId = 'usr-stu-1';

    try {
        const attemptCountRes = await query(
          `SELECT COUNT(*) as count FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2`,
          [id, studentId]
        );
        const attemptNum = parseInt(attemptCountRes.rows[0].count) + 1;
        
        console.log("Attempt num:", attemptNum);

        const attemptId = randomUUID();
        const attemptRes = await query(
          `INSERT INTO quiz_attempts (id, quiz_id, student_id, attempt_number, started_at, status)
           VALUES ($1, $2, $3, $4, datetime('now'), 'in_progress')
           RETURNING *`,
          [attemptId, id, studentId, attemptNum]
        );

        console.log("Insert success:", attemptRes);
    } catch (e) {
        console.error("Insert error:", e);
    }
})();
