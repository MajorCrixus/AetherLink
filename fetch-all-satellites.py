#!/usr/bin/env python3
"""
Modified Space-Track.org data fetcher
Based on SLTrack.py by Andrew Stokes
Modified to fetch ALL active satellites (not just Starlink)

Fetches satellite catalog and orbital data into JSON format
Uses proven Space-Track.org query patterns that work reliably
"""

import requests
import json
import time
from datetime import datetime
import os

class MyError(Exception):
    def __init__(self, args):
        Exception.__init__(self, "Error: {0}".format(args))
        self.args = args

# Space-Track.org REST API endpoints
uriBase = "https://www.space-track.org"
requestLogin = "/ajaxauth/login"
requestCmdAction = "/basicspacedata/query"

# Query patterns that WORK (proven from SLTrack.py)
# Get all active satellites (no decay date) using tle_latest class
requestFindActiveSats = "/class/tle_latest/ORDINAL/1/DECAY_DATE/null-val/format/json/orderby/NORAD_CAT_ID%20asc"

# Get detailed OMM data for a specific satellite
requestOMMSatellite = "/class/omm/NORAD_CAT_ID/{}/orderby/EPOCH%20desc/limit/1/format/json"

# Get SATCAT data for a specific satellite
requestSatcatSatellite = "/class/satcat/NORAD_CAT_ID/{}/format/json"

# Credentials from environment
username = os.environ.get('SPACETRACK_USERNAME', 'james.d.odum.mil@mail.mil')
password = os.environ.get('SPACETRACK_PASSWORD', 'Ky13!gh03202007')
siteCred = {'identity': username, 'password': password}

output_dir = '/home/major/aetherlink/temp'
os.makedirs(output_dir, exist_ok=True)

print("=" * 70)
print("Space-Track.org Data Fetcher")
print("=" * 70)
print(f"Fetching all active satellites from {uriBase}")
print(f"Output directory: {output_dir}")
print()

# Track statistics
stats = {
    'total_satellites': 0,
    'tle_fetched': 0,
    'omm_fetched': 0,
    'satcat_fetched': 0,
    'errors': 0,
    'start_time': time.time()
}

# Use requests session with Space-Track.org
with requests.Session() as session:
    print("[1/4] Logging in to Space-Track.org...")
    resp = session.post(uriBase + requestLogin, data=siteCred)
    if resp.status_code != 200:
        raise MyError(f"Login failed: HTTP {resp.status_code}")

    # Parse cookies properly (extract name=value only)
    cookies = resp.headers.get('set-cookie', '')
    if cookies:
        cookie_value = cookies.split(';')[0].strip()
        print(f"      ✓ Login successful")
        print(f"      Session cookie: {cookie_value[:50]}... ({len(cookie_value)} chars)")
    else:
        raise MyError("No session cookie received")

    print()
    print("[2/4] Fetching satellite catalog (TLE latest)...")
    print(f"      Query: {requestFindActiveSats}")

    # Get all active satellites using the PROVEN query pattern
    resp = session.get(uriBase + requestCmdAction + requestFindActiveSats)
    if resp.status_code != 200:
        print(f"      ✗ HTTP {resp.status_code}")
        error_body = resp.text[:200]
        print(f"      Response: {error_body}")
        raise MyError(f"Failed to fetch satellite list: HTTP {resp.status_code}")

    # Parse the satellite list
    satellites = json.loads(resp.text)
    stats['total_satellites'] = len(satellites)
    stats['tle_fetched'] = len(satellites)

    print(f"      ✓ Received {len(satellites)} active satellites")

    # Save the TLE data
    tle_file = os.path.join(output_dir, 'satellites_tle.json')
    with open(tle_file, 'w') as f:
        json.dump(satellites, f, indent=2)
    print(f"      ✓ Saved to {tle_file}")

    # Extract NORAD_CAT_IDs for detailed queries
    norad_ids = [sat['NORAD_CAT_ID'] for sat in satellites]

    print()
    print(f"[3/4] Fetching detailed OMM data for {len(norad_ids)} satellites...")
    print("      (This will take a while - rate limited to 18/min)")

    omm_data = []
    request_count = 0

    for idx, norad_id in enumerate(norad_ids, 1):
        # Rate limiting: Space-Track allows 20/min, we do 18/min to be safe
        if request_count >= 18:
            print(f"      Rate limit: Sleeping 60 seconds... ({idx}/{len(norad_ids)})")
            time.sleep(60)
            request_count = 0

        # Fetch OMM data for this satellite
        query = requestOMMSatellite.format(norad_id)
        resp = session.get(uriBase + requestCmdAction + query)

        if resp.status_code == 200:
            data = json.loads(resp.text)
            if data:  # Some satellites may not have OMM data
                omm_data.extend(data)
                stats['omm_fetched'] += 1
            if idx % 100 == 0:
                print(f"      Progress: {idx}/{len(norad_ids)} satellites ({stats['omm_fetched']} with OMM data)")
        else:
            stats['errors'] += 1
            if idx % 100 == 0:
                print(f"      Warning: HTTP {resp.status_code} for NORAD_CAT_ID={norad_id}")

        request_count += 1

    print(f"      ✓ Fetched OMM data for {stats['omm_fetched']} satellites")

    # Save OMM data
    omm_file = os.path.join(output_dir, 'satellites_omm.json')
    with open(omm_file, 'w') as f:
        json.dump(omm_data, f, indent=2)
    print(f"      ✓ Saved to {omm_file}")

    print()
    print(f"[4/4] Fetching SATCAT data for {len(norad_ids)} satellites...")

    satcat_data = []
    request_count = 0

    for idx, norad_id in enumerate(norad_ids, 1):
        # Rate limiting
        if request_count >= 18:
            print(f"      Rate limit: Sleeping 60 seconds... ({idx}/{len(norad_ids)})")
            time.sleep(60)
            request_count = 0

        # Fetch SATCAT data for this satellite
        query = requestSatcatSatellite.format(norad_id)
        resp = session.get(uriBase + requestCmdAction + query)

        if resp.status_code == 200:
            data = json.loads(resp.text)
            if data:
                satcat_data.extend(data)
                stats['satcat_fetched'] += 1
            if idx % 100 == 0:
                print(f"      Progress: {idx}/{len(norad_ids)} satellites ({stats['satcat_fetched']} with SATCAT data)")
        else:
            stats['errors'] += 1
            if idx % 100 == 0:
                print(f"      Warning: HTTP {resp.status_code} for NORAD_CAT_ID={norad_id}")

        request_count += 1

    print(f"      ✓ Fetched SATCAT data for {stats['satcat_fetched']} satellites")

    # Save SATCAT data
    satcat_file = os.path.join(output_dir, 'satellites_satcat.json')
    with open(satcat_file, 'w') as f:
        json.dump(satcat_data, f, indent=2)
    print(f"      ✓ Saved to {satcat_file}")

    session.close()

# Print final statistics
elapsed = time.time() - stats['start_time']
print()
print("=" * 70)
print("Fetch Complete!")
print("=" * 70)
print(f"Total satellites:    {stats['total_satellites']}")
print(f"TLE data fetched:    {stats['tle_fetched']}")
print(f"OMM data fetched:    {stats['omm_fetched']}")
print(f"SATCAT data fetched: {stats['satcat_fetched']}")
print(f"Errors encountered:  {stats['errors']}")
print(f"Time elapsed:        {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
print()
print("Output files:")
print(f"  - {tle_file}")
print(f"  - {omm_file}")
print(f"  - {satcat_file}")
print()
