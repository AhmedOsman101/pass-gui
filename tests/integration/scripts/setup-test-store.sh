#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# setup-test-store.sh — Generate ephemeral GPG key + init pass store
#
# Usage:
#   GNUPGHOME=/tmp/gpg PASSWORD_STORE_DIR=/tmp/store ./setup-test-store.sh
#
# Expects:
#   GNUPGHOME         — directory for GPG keyring (created if absent)
#   PASSWORD_STORE_DIR — directory for the pass store (created if absent)
#
# Produces:
#   A non-expiring, unprotected GPG key for "pass-gui Test <test@pass-gui.local>"
#   An initialized password-store at $PASSWORD_STORE_DIR
# ---------------------------------------------------------------------------
set -euo pipefail

BATCH_FILE="${GNUPGHOME}/batch.conf"

# ---- GPG key generation (non-interactive, no passphrase) ----
mkdir -p "${GNUPGHOME}"
chmod 700 "${GNUPGHOME}"

cat > "${BATCH_FILE}" <<- 'EOF'
%echo Generating pass-gui test GPG key
Key-Type: RSA
Key-Length: 2048
Subkey-Type: RSA
Subkey-Length: 2048
Name-Real: pass-gui Test
Name-Email: test@pass-gui.local
Expire-Date: 0
%no-protection
%commit
%echo Done
EOF

gpg --batch --gen-key "${BATCH_FILE}"

# ---- Initialize pass store ----
mkdir -p "${PASSWORD_STORE_DIR}"
pass init test@pass-gui.local

# ---- Insert sample entries ----
echo "correct-horse-battery-staple" | pass insert -e test/example
echo "sup3r-s3cr3t" | pass insert -e test/credentials/email
echo "hunter2" | pass insert -e test/credentials/gaming

echo "OK: Test store ready at ${PASSWORD_STORE_DIR}"
