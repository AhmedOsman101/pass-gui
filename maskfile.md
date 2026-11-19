# pass-gui

## lint

> Lint the project

**OPTIONS**

- reporter
  - flags: --reporter
  - type: string
  - desc: Output format (default|json|json-pretty|github|summary|concise)

```bash
unset BIOME_CONFIG_PATH &>/dev/null
pnpm exec biome lint . ${reporter:+--reporter "$reporter"}
```

## format

> Lint and format the project

**OPTIONS**

- reporter
  - flags: --reporter
  - type: string
  - desc: Output format (default|json|json-pretty|github|summary|concise)
- unsafe
  - flags: --unsafe
  - type: boolean
  - desc: Apply unsafe fixes

```bash
unset BIOME_CONFIG_PATH &>/dev/null
pnpm exec biome check --fix . ${reporter:+--reporter "$reporter"} ${unsafe:+'--unsafe'}
```

## typecheck

> Run type checking

```bash
cd client && pnpm typecheck
```

## neu (args)

> Execute a `neu` command.

```bash
declare -a argv
eval "argv=(${args})"
pnpm exec -- neu "${argv[@]}"
```

## dev

> Run development servers (frontend + Neutralino)

```bash
concurrently -n "FRONTEND,NEUTRALINO" -c "blue,magenta" \
  "$MASK dev frontend" \
  "$MASK dev neutralino"
```

### frontend

> Start the Vite frontend dev server

```bash
cd client && pnpm dev
```

### neutralino

> Run Neutralino in dev mode

```bash
$MASK neu 'run dev'
```

## build

> Build the project (frontend + Neutralino) with embedded resources into `dist/pass-gui/`

```bash
$MASK clean
$MASK neu 'build --release --clean --embed-resources'
```

### frontend

> Build only the frontend (typecheck + vite build)

```bash
cd client && pnpm build
```

### clean

> Clean artifacts and build

```bash
$MASK clean
$MASK build
```

## clean

> Remove build artifacts

```bash
rm -rf client/dist/ dist/ .neu-builder-staging
```

## release

> Build a release version with resources embedded in the binaries (SEA)

**OPTIONS**

- full
  - flags: --full
  - type: boolean
  - desc: Also build all installers the host supports (deb + appimage + nsis on Linux, dmg on macOS)

```bash
$MASK build
if [[ "$full" == "true" ]]; then
  $MASK package
fi
```

### pr [args]

> Create a release PR using release-please

```bash
declare -a argv
eval 'argv=(${args})'
remote="$(git remote get-url origin)"
repoUrl="${remote/git@github.com:/https://github.com/}.git"

release-please release-pr \
  --repo-url="${repoUrl}" \
  --token="${GITHUB_TOKEN:-token-missing}" \
  --config-file="release-please-config.json" \
  "${argv[@]}"
```

### gh [args]

> Create a GitHub release using release-please (or force with -f)

**OPTIONS**

- force
  - flags: -f --force
  - type: boolean
  - desc: Force release — create tag + GitHub release directly (triggers release.yml workflow)

```bash
declare -a argv
eval 'argv=(${args})'
remote="$(git remote get-url origin)"
repoUrl="${remote/git@github.com:/https://github.com/}.git"

if [[ "${force}" == "true" ]]; then
  VERSION="$(jq -r .version package.json)"
  TAG_NAME="v${VERSION}"

  echo "Force releasing ${TAG_NAME}..."

  git push origin ":refs/tags/${TAG_NAME}" 2>/dev/null || true
  git tag -f "${TAG_NAME}"
  git push origin "${TAG_NAME}" --force

  sleep 3

  gh release create "${TAG_NAME}" \
    --title "Release ${TAG_NAME}" \
    --generate-notes \
    --target main

  echo "Release created! Binaries will be built and uploaded automatically."
else
  release-please github-release \
    --repo-url="${repoUrl}" \
    --token="${GITHUB_TOKEN:-token-missing}" \
    --config-file="release-please-config.json" \
    "${argv[@]}"
fi
```

## package

> Build all installers the current host supports

```bash
case "$(uname -s)" in
  Linux*)
    $MASK package deb || echo "WARN: deb build failed" >&2
    $MASK package appimage || echo "WARN: appimage build failed" >&2
    $MASK package nsis || echo "WARN: nsis build failed (install 'nsis' for Windows installer)" >&2
    ;;
  Darwin*)
    $MASK package dmg || echo "WARN: dmg build failed" >&2
    ;;
  *)
    echo "Unsupported host: $(uname -s)" >&2
    exit 1
    ;;
esac
```

### deb [arch]

> Build a Debian package (`.deb`)

```bash
$MASK neu "builder deb ${arch:+"--$arch"}"
```

### appimage [arch]

> Build a portable AppImage (`.AppImage`)

```bash
$MASK neu "builder appimage ${arch:+"--$arch"}"
```

### nsis [arch]

> Build a Windows installer (`.exe`) — requires `makensis` on the host

```bash
$MASK neu "builder nsis ${arch:+"--$arch"}"
```

### dmg [arch]

> Build a macOS disk image (`.dmg`) — macOS host only

```bash
$MASK neu "builder dmg ${arch:+"--$arch"}"
```

## container

> Commands to control the Podman testing container

### build

> Builds the container for integration testing

```bash
podman build \
  --build-arg USER_UID="$(id -u)" \
  --build-arg USER_GID="$(id -g)" \
  -t pass-gui-test \
  -f Dockerfile
```

### run (command)

> Runs the integration testing on the container

**OPTIONS**

- interactive
  - flags: -i --interactive
  - type: boolean
  - desc: Make STDIN available to the contained process and allocate a pseudo-TTY for container

```bash
podman run --rm ${interactive:+'-it'} \
  --userns=keep-id \
  -p 3000:3000 \
  -p 3001:3001 \
  -v "$(pwd):/app" \
  -v "$(pwd)/neutralino.config.container.json:/app/neutralino.config.json:ro" \
  -v "$(pwd)/.container/node_modules:/app/node_modules" \
  -v "$(pwd)/.container/pnpm-store:/home/testuser/.local/share/pnpm/store" \
  pass-gui-test \
  bash -c "${command}"
```

### dev

> Runs the project inside the container

```bash
$MASK container run 'pnpm dev'
```
