const autocannon = require('autocannon');

const SUPABASE_URL = 'https://kflilxgaigcduahhfjdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbGlseGdhaWdjZHVhaGhmamRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NTQ5OTcsImV4cCI6MjA5NjIzMDk5N30.oZYreLSbguDUV0Amk5wVmA1eABSbPf4ay94NiLA2Zk4';

let userIndex = 0;

const instance = autocannon({
  url: `${SUPABASE_URL}/rest/v1/players`,
  connections: 150,
  amount: 150,  // exactly 1 request per connection — simulates 150 simultaneous single logins
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Prefer': 'resolution=merge-duplicates',
  },
  setupClient(client) {
    const id = ++userIndex;
    const team = ((id - 1) % 23) + 1;
    client.setBody(JSON.stringify({ name: `LoadTestUser_${id}`, team_number: team }));
  },
});

autocannon.track(instance, { renderProgressBar: false });

instance.on('done', (result) => {
  const { requests, latency, errors, non2xx, timeouts } = result;

  const total = requests.total;
  const successful = total - (errors || 0) - (non2xx || 0) - (timeouts || 0);
  const failed = total - successful;

  console.log('\n=== Load Test Results (150 simultaneous single logins) ===');
  console.log(`Total requests:      ${total}`);
  console.log(`Successful (2xx):    ${successful}`);
  console.log(`Failed:              ${failed}`);
  console.log(`Avg response time:   ${latency.mean.toFixed(2)} ms`);
  console.log(`Max response time:   ${latency.max} ms`);
  console.log(`Errors:              ${errors || 0}`);
  console.log(`Non-2xx responses:   ${non2xx || 0}`);
  console.log(`Timeouts:            ${timeouts || 0}`);
});
