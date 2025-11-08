# AetherLink Sudoers Configuration

## Purpose

This configuration allows the AetherLink webapp to restart services without requiring a sudo password. This is necessary for:

1. **Process Management**: Killing backend/frontend processes on ports 9000 and 3001
2. **Firewall Configuration**: Opening firewall ports for network access
3. **Serial Port Access**: Configuring permissions for hardware communication (IMU, GPS, servos)

## Security Considerations

The configuration grants **minimal permissions** only for specific commands:
- `kill` and `killall` - to stop webapp processes
- `ufw allow 9000/tcp` and `ufw allow 3001/tcp` - to configure firewall
- `chmod` for `/dev/ttyUSB*` and `/dev/ttyACM*` - for serial hardware access

This is much safer than granting full sudo access without a password.

## Installation

### Step 1: Validate the Configuration

First, check that the sudoers file has valid syntax:

```bash
sudo visudo -c -f /home/major/aetherlink/aetherlink-sudoers
```

You should see: `parsed OK`

### Step 2: Install the Configuration

Run the installation script:

```bash
cd /home/major/aetherlink
sudo ./install-sudoers.sh
```

### Step 3: Test the Configuration

Test that you can now use sudo commands without a password:

```bash
# Test kill command (this should NOT prompt for password)
sudo -n kill -0 $$ && echo "Success: can kill without password"

# Test firewall command (this should NOT prompt for password)
sudo -n ufw status && echo "Success: can check firewall without password"
```

## Manual Installation (Alternative)

If you prefer to install manually:

```bash
# Validate syntax
sudo visudo -c -f /home/major/aetherlink/aetherlink-sudoers

# Copy to sudoers directory
sudo cp /home/major/aetherlink/aetherlink-sudoers /etc/sudoers.d/aetherlink

# Set correct permissions
sudo chmod 440 /etc/sudoers.d/aetherlink
sudo chown root:root /etc/sudoers.d/aetherlink

# Verify system configuration
sudo visudo -c
```

## Uninstallation

To remove the configuration:

```bash
sudo rm /etc/sudoers.d/aetherlink
```

## Benefits

After installation, the webapp scripts can:
- Automatically restart services without password prompts
- Kill orphaned processes on webapp ports
- Configure firewall rules during startup
- Access serial hardware for IMU, GPS, and servo control

This makes development and deployment much smoother!
