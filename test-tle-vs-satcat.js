#!/usr/bin/env node
// Test tle_latest vs satcat for bulk queries

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
  console.log('✓ Logged in');
  console.log();

  // Test 1: tle_latest (what SLTrack.py uses)
  console.log('[TEST 1] Fetching with tle_latest (proven working)...');
  const query1 = 'https://www.space-track.org/basicspacedata/query/class/tle_latest/ORDINAL/1/DECAY_DATE/null-val/format/json/limit/10';
  console.log('Query:', query1);

  const resp1 = await fetch(query1, { headers: { Cookie: cookie } });
  console.log('Status:', resp1.status, resp1.statusText);

  if (resp1.ok) {
    const data1 = await resp1.json();
    console.log('Records:', data1.length);
    if (data1.length > 0) {
      console.log('Sample fields:', Object.keys(data1[0]).slice(0, 10).join(', '));
    }
  } else {
    console.log('Error:', await resp1.text());
  }

  console.log();

  // Test 2: satcat (what we're currently using)
  console.log('[TEST 2] Fetching with satcat (currently failing)...');
  const query2 = 'https://www.space-track.org/basicspacedata/query/class/satcat/DECAY_DATE/null-val/OBJECT_TYPE/PAYLOAD/format/json/limit/10';
  console.log('Query:', query2);

  const resp2 = await fetch(query2, { headers: { Cookie: cookie } });
  console.log('Status:', resp2.status, resp2.statusText);

  if (resp2.ok) {
    const data2 = await resp2.json();
    console.log('Records:', data2.length);
    if (data2.length > 0) {
      console.log('Sample fields:', Object.keys(data2[0]).slice(0, 10).join(', '));
    }
  } else {
    const errorText = await resp2.text();
    console.log('Error:', errorText.substring(0, 200));
  }

  console.log();

  // Test 3: Try tle_latest for ALL active satellites (no limit)
  console.log('[TEST 3] Fetching ALL active satellites with tle_latest (no limit)...');
  const query3 = 'https://www.space-track.org/basicspacedata/query/class/tle_latest/ORDINAL/1/DECAY_DATE/null-val/format/json';
  console.log('Query:', query3);

  const startTime = Date.now();
  const resp3 = await fetch(query3, { headers: { Cookie: cookie } });
  const elapsed = Date.now() - startTime;

  console.log('Status:', resp3.status, resp3.statusText);
  console.log('Time:', elapsed + 'ms');

  if (resp3.ok) {
    const data3 = await resp3.json();
    console.log('✓ SUCCESS! Received', data3.length, 'satellites in ONE request');
  } else {
    const errorText = await resp3.text();
    console.log('Error:', errorText.substring(0, 200));
  }
}

test().catch(console.error);
