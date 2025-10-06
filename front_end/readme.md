
<img width="1632" height="640" alt="image" src="https://github.com/user-attachments/assets/2ae25f97-5d66-491a-a91a-5b3cb63599f6" />

# Aetherlink Satellite Antenna Control Dashboard - AI Design Prompt

# Project Overview
# ----------------
# Design a desktop web dashboard for "Aetherlink"—a satellite antenna control system hosted on a Raspberry Pi 4B.
# The dashboard should feature a dark, futuristic, sci-fi theme with soft blues and greens, glowing accents, soft edges, and clean modern typography.
# No logo is required.

# Core Features
# -------------

## Central Interactive 3D Globe
# - Google Earth-style, zoomable and rotatable.
# - Shows real-time position and orientation of a digital satellite antenna (use a stylized version of the provided antenna frame image).
# - Displays satellite icons, orbit lines, and a geographically accurate antenna marker.
# - Supports multiple satellites: filter by orbit type (LEO, MEO, HEO, GEO), frequency bands, and satellites overhead within a specified time window.
# - Clickable satellites open modal pop-ups with detailed info and an “Acquire” button.

## INAV-Inspired Sidebar Navigation
# - Persistent, collapsible sidebar with clear icons and labels.
# - Main sections: Dashboard, Setup/Configuration, 3D Antenna View, Modules (GPS, IMU, Servos, SDR, Database), Logs & Events, CLI.
# - Expandable sub-menus for each module, showing detailed data, configuration, and health/status indicators.

## HUD-Style Sensor Displays
# - Circular GPS data HUD (top-left or top-right).
# - Vertical or arc-style Azimuth/Elevation gauges (edges).
# - Scrolling SDR-style waterfall display (bottom).
# - 3D IMU artificial horizon (corner or overlay).
# - Small system health/status icons (corners or floating).
# - Mini log/events feed (floating or side panel).

## Servo & Pointing Controls
# - Manual and automatic pointing modes.
# - Sliders/dials for Azimuth, Elevation, Cross-Level.
# - Visual alignment assistant for target acquisition.

## Live Data Panels
# - Real-time Azimuth, Elevation, Cross-Level, GPS, IMU data.
# - Selected satellite info.

## Customization
# - Add/remove/rearrange dashboard widgets (drag-and-drop).
# - Theme tweaks (glow intensity, color adjustments).

## Settings & Configuration
# - Dedicated page for calibration and settings of all components, especially Maker servo57D (v1.0.6) motors.
# - API endpoint configuration.
# - Step-by-step setup wizards.

## Other Features
# - Demo mode for UI testing without hardware.
# - Export logs/data for troubleshooting.
# - Local network access only (no remote access).
# - No mobile version, desktop-focused but responsive.
# - Embedded CLI for direct system interaction.

# Visual Style
# ------------
# - Sci-fi, immersive look.
# - Soft edges, glowing accents, and subtle animations.
# - No logo, but strong project branding through color and typography.

# Inspiration
# -----------
# - INAV Configurator’s sidebar/menu structure, 3D model view, and modular breakdown of system components.

# Deliverables
# ------------
# - Visual wireframes/mockups (not code) of the main dashboard, sidebar navigation, 3D antenna view, module sub-menus, and configuration page.
# - Emphasize clarity, modularity, and a futuristic, immersive user experience.
