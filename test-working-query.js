#!/usr/bin/env node
// Test the EXACT query pattern from SLTrack.py that works

const username = 'james.d.odum.mil@mail.mil';
const password = 'Ky13!gh03202007';

async function test() {
  // Login
  const loginResp = await fetch('https://www.space-track.org/ajaxauth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `identity=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  });

  const cookie = loginResp.headers.get('set-cookie').split(';')[0];
  console.log('✓ Logged in\n');

  // Test 1: Exact SLTrack.py query (Starlink only, limit 10)
  console.log('[TEST 1] SLTrack.py pattern for Starlink (limited to 10)...');
  const query1 = 'https://www.space-track.org/basicspacedata/query/class/tle_latest/NORAD_CAT_ID/>40000/ORDINAL/1/OBJECT_NAME/STARLINK~~/format/json/limit/10';
  console.log(query1);

  const resp1 = await fetch(query1, { headers: { Cookie: cookie } });
  console.log('Status:', resp1.status);

  if (resp1.ok) {
    const data = await resp1.json();
    console.log('✓ Received', data.length, 'satellites\n');
  } else {
    console.log('✗ Error:', (await resp1.text()).substring(0, 300), '\n');
  }

  // Test 2: Get ALL tle_latest (no DECAY_DATE filter - doesn't exist!)
  console.log('[TEST 2] All tle_latest with ORDINAL/1 (no DECAY_DATE filter)...');
  const query2 = 'https://www.space-track.org/basicspacedata/query/class/tle_latest/ORDINAL/1/format/json';
  console.log(query2);

  const start = Date.now();
  const resp2 = await fetch(query2, { headers: { Cookie: cookie } });
  const elapsed = Date.now() - start;

  console.log('Status:', resp2.status);
  console.log('Time:', elapsed + 'ms');

  if (resp2.ok) {
    const data = await resp2.json();
    console.log('✓ SUCCESS! Received', data.length, 'satellites in ONE request');
    console.log('  Sample fields:', Object.keys(data[0]).join(', '));
  } else {
    console.log('✗ Error:', (await resp2.text()).substring(0, 300));
  }

  console.log();

  // Test 3: GP class for TLEs (alternative)
  console.log('[TEST 3] GP class with DECAY_DATE filter (Space-Track docs recommend)...');
  const query3 = 'https://www.space-track.org/basicspacedata/query/class/gp/DECAY_DATE/null-val/EPOCH/>now-30/format/json/limit/10';
  console.log(query3);

  const resp3 = await fetch(query3, { headers: { Cookie: cookie } });
  console.log('Status:', resp3.status);

  if (resp3.ok) {
    const data = await resp3.json();
    console.log('✓ Received', data.length, 'GP records');
  } else {
    console.log('✗ Error:', (await resp3.text()).substring(0, 300));
  }
}

test().catch(console.error);
