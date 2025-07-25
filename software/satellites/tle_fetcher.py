import requests
import os
from dotenv import load_dotenv
from pathlib import Path
import json

# Load credentials from .env
ENV_PATH = Path(__file__).parents[1] / "config" / ".env"
load_dotenv(dotenv_path=ENV_PATH)

USERNAME = os.getenv("SPACE_TRACK_USERNAME")
PASSWORD = os.getenv("SPACE_TRACK_PASSWORD")

BASE_URL = "https://www.space-track.org"

TLE_ENDPOINT = (
    "/basicspacedata/query/class/tle_latest/"
    "orderby/NORAD_CAT_ID desc/format/json"
)

def fetch_tle(group="active", save_path="data/tle_cache.json"):
    """
    Fetch latest TLEs from space-track.org and save to a JSON file.
    """
    session = requests.Session()

    # Authenticate
    login_url = f"{BASE_URL}/ajaxauth/login"
    login_payload = {
        "identity": USERNAME,
        "password": PASSWORD
    }

    print("[🛰️] Authenticating with space-track.org...")
    resp = session.post(login_url, data=login_payload)
    if resp.status_code != 200:
        raise Exception(f"Login failed: {resp.status_code} {resp.text}")

    print("[✅] Authenticated. Downloading TLE data...")

    # Adjust query by group
    url = f"{BASE_URL}{TLE_ENDPOINT}"

    if group:
        url = (
            f"{BASE_URL}/basicspacedata/query/class/tle_latest/"
            f"group/{group}/orderby/NORAD_CAT_ID desc/format/json"
        )

    tle_response = session.get(url)
    tle_response.raise_for_status()

    tle_data = tle_response.json()

    os.makedirs(Path(save_path).parent, exist_ok=True)
    with open(save_path, "w") as f:
        json.dump(tle_data, f, indent=2)

    print(f"[💾] TLEs saved to {save_path} ({len(tle_data)} entries)")
    return tle_data
