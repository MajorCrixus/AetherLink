import json
from pathlib import Path
from datetime import datetime
from skyfield.api import EarthSatellite, load, wgs84

TLE_PATH = Path("data/tle_cache.json")
DB_OUT = Path("data/sat_db.json")

ts = load.timescale()

def classify_orbit(alt_km: float) -> str:
    """Classify orbit by altitude"""
    if alt_km < 2000:
        return "LEO"
    elif alt_km < 35786 - 1000:
        return "MEO"
    elif 33786 <= alt_km <= 37786:
        return "GEO"
    else:
        return "HEO"

def build_satellite_db():
    with open(TLE_PATH) as f:
        tle_list = json.load(f)

    sats = []
    for tle in tle_list:
        name = tle["OBJECT_NAME"]
        line1 = tle["TLE_LINE1"]
        line2 = tle["TLE_LINE2"]
        norad_id = tle["NORAD_CAT_ID"]

        try:
            sat = EarthSatellite(line1, line2, name, ts)
            geocentric = sat.at(ts.now())
            subpoint = wgs84.subpoint(geocentric)
            alt_km = subpoint.elevation.km
            orbit_class = classify_orbit(alt_km)

            sats.append({
                "name": name,
                "norad_id": norad_id,
                "orbit": orbit_class,
                "altitude_km": round(alt_km, 2),
                "tle": [line1, line2],
                "country": tle.get("COUNTRY", "Unknown"),
                "launch_date": tle.get("LAUNCH_DATE", "Unknown"),
                "freq_band": "Unknown",  # to be enriched later
                "beacon_mhz": None,      # to be enriched later
            })
        except Exception as e:
            print(f"[⚠️] Failed to parse {name}: {e}")

    # Save enriched DB
    os.makedirs(DB_OUT.parent, exist_ok=True)
    with open(DB_OUT, "w") as f:
        json.dump(sats, f, indent=2)

    print(f"[✅] Satellite DB written to {DB_OUT} ({len(sats)} entries)")
    return sats
