# Dockerfile — Integration test environment for pass-gui
#
# Build:   mask container build
# Run:     mask container run '<command>'
#
# The container has Node.js 24, pnpm, GPG, and pass pre-installed.
# Mount the project root at /app, then run pnpm install + integration tests.
#
# Void Linux base = smaller image, faster builds than Debian slim

FROM ghcr.io/void-linux/void-glibc-full

# Sync repodata and update xbps itself first. Void images sometimes
# ship with a stale xbps binary; skipping this step can break -Sy.
RUN xbps-install -Syu xbps && xbps-install -Syu

# Stable base — almost never changes, cache holds long-term
# gnupg        — GPG encryption for pass
# pass         — the standard Unix password store
# git          — pass uses git internally
# nodejs       — verify version matches your pinned engines field
# shadow       — useradd/groupadd (may already be in -full, kept explicit)
RUN xbps-install -Sy gnupg pass git nodejs bash

# More likely to change during development
RUN xbps-install -Sy pinentry pinentry-tty libwebkitgtk60

# Install pnpm at the project's pinned version
RUN npm install -g pnpm@11.17.0

# Integration test guard — prevents accidental runs outside the container
ENV PASS_GUI_CONTAINER=1
ENV GNUPGHOME=/home/testuser/.gnupg
ENV PASSWORD_STORE_DIR=/home/testuser/.password-store
ENV GPG_TTY=/dev/console
ENV GPG_AGENT_INFO=

# Build args let you match your host UID/GID so bind-mounted
# files stay writable and don't end up owned by a foreign UID
ARG USER_UID=1000
ARG USER_GID=1000

# Create a non-root user with writable home for GPG
RUN groupadd -g "${USER_GID}" testuser \
  && useradd -u "${USER_UID}" -g testuser -m -d /home/testuser -s /bin/bash testuser \
  && mkdir -p /app "${GNUPGHOME}" "${PASSWORD_STORE_DIR}" \
  && chown -R testuser:testuser /home/testuser /app \
  && chmod 700 "${GNUPGHOME}"

USER testuser
WORKDIR /app

# Dummy git identity so git commands work inside the container
RUN git config --global user.name "Test User" \
  && git config --global user.email "test@example.com"

# Prevent pnpm from leaking into the project directory
RUN pnpm config set store-dir /home/testuser/.local/share/pnpm/store

CMD ["bash"]
