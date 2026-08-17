const http = require('http');

async function check() {
  const req1 = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, res => {
    let data = '';
    const cookie = res.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');
    res.on('data', c => data += c);
    res.on('end', () => {
      const req2 = http.request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/quizzes',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookie
        }
      }, res2 => {
        let data2 = '';
        res2.on('data', c => data2 += c);
        res2.on('end', () => {
          console.log('STATUS:', res2.statusCode);
          try {
            const parsed = JSON.parse(data2);
            console.log('PARSED ERROR:', parsed);
          } catch(e) {
            console.log('RAW ERROR:', data2);
          }
        });
      });
      req2.write(JSON.stringify({
        title: 'Test Quiz',
        course_id: 'crs-csc111'
      }));
      req2.end();
    });
  });
  req1.write(JSON.stringify({ email: 'lecturer@ndu.edu.ng', password: 'Password123!' }));
  req1.end();
}

check();
