#!/bin/bash

# =====================================================
# apply_overlay.sh
# Automates compiling and installing a Device Tree Overlay (.dtbo)
# for Jetson Linux systems. Also modifies extlinux.conf.
# Requires: dtc (Device Tree Compiler)
# =====================================================

set -e

# ---------- Constants ----------
OVERLAY_DIR="/boot/firmware"
EXTLINUX="/boot/extlinux/extlinux.conf"
BACKUP_FILE="${EXTLINUX}.bak"

# ---------- Functions ----------
function error_exit {
    echo "❌ Error: $1"
    exit 1
}

function check_requirements {
    echo "🔍 Checking for dependencies..."
    command -v dtc >/dev/null 2>&1 || error_exit "Device Tree Compiler (dtc) is not installed."
    [[ -f "$1" ]] || error_exit "Input DTS file '$1' not found."
    [[ -f "$EXTLINUX" ]] || error_exit "extlinux.conf not found at expected path."
    echo "✅ Dependencies OK."
}

function compile_overlay {
    echo "⚙️  Compiling $1 -> $2..."
    dtc -I dts -O dtb -o "$2" "$1" || error_exit "Compilation failed."
    echo "✅ Overlay compiled."
}

function install_overlay {
    echo "📁 Copying $1 to $OVERLAY_DIR..."
    sudo cp "$1" "$OVERLAY_DIR/" || error_exit "Failed to copy .dtbo file."
    echo "✅ Installed to $OVERLAY_DIR."
}

function backup_extlinux {
    echo "📦 Backing up $EXTLINUX to $BACKUP_FILE..."
    sudo cp "$EXTLINUX" "$BACKUP_FILE" || error_exit "Backup failed."
    echo "✅ Backup complete."
}

function patch_extlinux {
    local DTBO_FILENAME=$(basename "$1")
    echo "📝 Patching extlinux.conf to apply overlay $DTBO_FILENAME..."

    if grep -q "$DTBO_FILENAME" "$EXTLINUX"; then
        echo "⚠️  Overlay $DTBO_FILENAME already listed in extlinux.conf. Skipping patch."
        return
    fi

    # Add FDT/overlays line to extlinux.conf (assumes single LABEL section)
    sudo sed -i "/^\s*APPEND / a \ \ FDT /boot/firmware/$DTBO_FILENAME" "$EXTLINUX"
    echo "✅ Overlay line added to extlinux.conf."
}

# ---------- Main ----------
if [[ $# -ne 1 ]]; then
    echo "Usage: sudo $0 <overlay.dts>"
    exit 1
fi

INPUT_DTS="$1"
DTBO_NAME="${INPUT_DTS%.dts}.dtbo"

check_requirements "$INPUT_DTS"
compile_overlay "$INPUT_DTS" "$DTBO_NAME"
install_overlay "$DTBO_NAME"
backup_extlinux
patch_extlinux "$DTBO_NAME"

echo "🔁 Would you like to reboot now to apply the overlay? [y/N]"
read -r confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
    echo "🔄 Rebooting..."
    sudo reboot
else
    echo "🚨 Manual reboot required to apply overlay."
fi
