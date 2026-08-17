const { execSync } = require('child_process');
const output = execSync('node run_e2e_tests.js').toString();
const lines = output.split('\n');

for (const line of lines) {
  if (line.includes('[FAIL]')) {
    const parts = line.split('|');
    console.log(parts[0]); // Print test name & status
    if (parts[1]) console.log('  ', parts[1].trim()); // Print http status
    if (parts[2]) console.log('  ', parts[2].trim().substring(0, 150)); // Print data snippet
  }
}
