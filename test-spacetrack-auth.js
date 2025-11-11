#!/usr/bin/env node
/**
 * Test Space-Track Authentication & Cookie Handling
 *
 * This script tests that:
 * 1. Login succeeds and returns a session cookie
 * 2. Cookie is parsed correctly (name=value only, no metadata)
 * 3. Subsequent API requests work with the parsed cookie
 */

const https = require('https');
const http = require('http');

// Space-Track credentials (from environment or hardcoded)
const USERNAME = process.env.SPACETRACK_USER || 'james.d.odum.mil@mail.mil';
const PASSWORD = process.env.SPACETRACK_PASS || 'Ky13!gh03202007';

console.log('============================================================');
console.log('Space-Track Authentication Test');
console.log('============================================================\n');

// Test login and cookie handling
async function testAuthentication() {
  try {
    // STEP 1: Login
    console.log('[1/3] Logging in to Space-Track...');
    console.log(`      User: ${USERNAME}`);

    const loginResponse = await fetch('https://www.space-track.org/ajaxauth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `identity=${encodeURIComponent(USERNAME)}&password=${encodeURIComponent(PASSWORD)}`,
    });

    if (!loginResponse.ok) {
      console.error(`✗ Login failed: HTTP ${loginResponse.status} ${loginResponse.statusText}`);
      process.exit(1);
    }

    // Extract Set-Cookie header
    const setCookie = loginResponse.headers.get('set-cookie');
    if (!setCookie) {
      console.error('✗ No Set-Cookie header received from Space-Track');
      process.exit(1);
    }

    console.log('✓ Login successful (HTTP 200)');
    console.log(`      Raw Set-Cookie: ${setCookie.substring(0, 100)}...`);
    console.log(`      Total length: ${setCookie.length} characters\n`);

    // STEP 2: Parse cookie correctly
    console.log('[2/3] Parsing session cookie...');

    // OLD (BROKEN) WAY: Use entire Set-Cookie header
    const brokenCookie = setCookie;

    // NEW (FIXED) WAY: Extract only name=value
    const parsedCookie = setCookie.split(';')[0].trim();

    console.log(`      OLD (broken): ${brokenCookie.substring(0, 80)}... (${brokenCookie.length} chars)`);
    console.log(`      NEW (fixed):  ${parsedCookie} (${parsedCookie.length} chars)`);
    console.log('✓ Cookie parsed\n');

    // STEP 3: Test API request with parsed cookie
    console.log('[3/3] Testing API request with parsed cookie...');
    console.log('      Query: /basicspacedata/query/class/satcat/NORAD_CAT_ID/25544/format/json');
    console.log('      (Fetching ISS satellite data - NORAD ID 25544)');

    const testUrl = 'https://www.space-track.org/basicspacedata/query/class/satcat/NORAD_CAT_ID/25544/format/json';

    const apiResponse = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Cookie': parsedCookie,  // Use the FIXED cookie parsing
      },
    });

    console.log(`      Response: HTTP ${apiResponse.status} ${apiResponse.statusText}`);

    if (!apiResponse.ok) {
      console.error(`\n✗ API request failed: HTTP ${apiResponse.status}`);
      console.error('  This suggests the cookie parsing may still be incorrect');

      // Try to get response body for more details
      const errorText = await apiResponse.text();
      console.error(`  Response body: ${errorText.substring(0, 200)}`);
      process.exit(1);
    }

    // Parse response
    const data = await apiResponse.json();

    console.log(`✓ API request successful (HTTP 200)`);
    console.log(`      Records received: ${data.length}`);

    if (data.length > 0) {
      const iss = data[0];
      console.log(`      Sample data: ${iss.OBJECT_NAME} (NORAD ${iss.NORAD_CAT_ID})`);
    }

    console.log('\n============================================================');
    console.log('✓ ALL TESTS PASSED');
    console.log('============================================================');
    console.log('\nCookie parsing is working correctly!');
    console.log('The Space-Track integration should now work properly.\n');

  } catch (error) {
    console.error('\n✗ Test failed with error:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testAuthentication();
