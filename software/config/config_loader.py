"""
Environment and YAML Config Loader
Reads from .env first, then settings.yaml as fallback
"""

import os
import yaml
from dotenv import load_dotenv
from pathlib import Path

# Load .env if it exists
load_dotenv()

# Default path
CONFIG_YAML = Path("software/config/settings.yaml")

def load_yaml():
    with open(CONFIG_YAML, "r") as f:
        return yaml.safe_load(f)

CONFIG = load_yaml()

def get(key: str, default=None):
    """
    Try to fetch from environment, then YAML fallback
    Dotted keys are supported for YAML nested values.
    Example: get("serial_ports.gps") → config["serial_ports"]["gps"]
    """
    if key.upper() in os.environ:
        return os.environ[key.upper()]

    # Walk YAML if dotted key
    parts = key.split(".")
    value = CONFIG
    for p in parts:
        if isinstance(value, dict) and p in value:
            value = value[p]
        else:
            return default
    return value
