#!/usr/bin/env node
/**
 * Log in to Space-Track and read the full API documentation
 */

const username = 'james.d.odum.mil@mail.mil';
const password = 'Ky13!gh03202007';

async function readDocs() {
  console.log('Logging in to Space-Track.org...');

  // Login
  const loginResp = await fetch('https://www.space-track.org/ajaxauth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `identity=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  });

  const cookie = loginResp.headers.get('set-cookie').split(';')[0];
  console.log('✓ Logged in\n');

  // Fetch API documentation pages
  const pages = [
    'https://www.space-track.org/documentation#/api',
    'https://www.space-track.org/documentation#howto',
    'https://www.space-track.org/documentation#/tle',
    'https://www.space-track.org/documentation#/satcat',
    'https://www.space-track.org/documentation#/gp',
  ];

  for (const url of pages) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Fetching: ${url}`);
    console.log('='.repeat(80));

    const resp = await fetch(url, {
      headers: {
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const html = await resp.text();

    // Extract text content (basic HTML stripping)
    const text = html
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Look for key information
    const sections = [
      'API',
      'REST',
      'query',
      'class',
      'predicate',
      'SATCAT',
      'TLE',
      'gp',
      'tle_latest',
      'DECAY_DATE',
      'rate limit',
      'example',
    ];

    console.log('\nKey sections found:');
    sections.forEach(section => {
      const regex = new RegExp(`.{0,200}${section}.{0,200}`, 'i');
      const match = text.match(regex);
      if (match) {
        console.log(`\n[${section}]`);
        console.log(match[0].trim());
      }
    });
  }
}

readDocs().catch(console.error);
