const http = require('http');

function loginUser(email, password) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`LOGIN FOR ${email}: status=${res.statusCode}, body=${data}`);
        resolve();
      });
    });
    req.write(JSON.stringify({ email, password }));
    req.end();
  });
}

async function main() {
  await loginUser('student@ndu.edu.ng', 'Password123!');
  await loginUser('lecturer@ndu.edu.ng', 'Password123!');
  await loginUser('admin@ndu.edu.ng', 'Password123!');
}

main();
