# pass-gui

## lint

> Lint the project

**OPTIONS**

- reporter
  - flags: --reporter
  - type: string
  - desc: Output format (default|json|json-pretty|github|junit|summary|gitlab|checkstyle|rdjson|sarif|concise)

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
neu run dev
```

## build

> Build the project (frontend + Neutralino)

```bash
$MASK build frontend && neu build
```

### frontend

> Build only the frontend (typecheck + vite build)

```bash
cd client && pnpm build
```

### clean

> Clean artifacts and build

```bash
$MASK clean && $MASK build
```

## clean

> Remove build artifacts

```bash
rm -rf client/dist/ build/
```

## release

> Build a release version with embedded resources

```bash
$MASK clean && neu build --release --clean --embed-resources
```

## test

> Run unit tests

```bash
cd client && pnpm test:unit
```

### coverage

> Run tests with coverage

```bash
cd client && pnpm test:coverage
```

### integration

> Run integration tests (must run inside the Podman container)

```bash
$MASK test integration build && $MASK test integration run
```

#### build

> Builds the container for integration testing

```bash
$MASK container build
```

#### run

> Runs the integration testing on the container

**OPTIONS**

- interactive
  - flags: -i --interactive
  - type: boolean
  - desc: Make STDIN available to the contained process and allocate a pseudo-TTY for container

```bash
$MASK container run \
  "pnpm install; pnpm vitest run --config vitest.integration.config.ts"
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
  -v "$(pwd)":/app \
  -v "$(pwd)/.container/node_modules":/app/node_modules \
  -v "$(pwd)/.container/pnpm-store":/home/testuser/.local/share/pnpm/store \
  pass-gui-test \
  bash -c "${command}"
```

### dev

> Runs the project inside the container

**OPTIONS**

- interactive
  - flags: -i --interactive
  - type: boolean
  - desc: Make STDIN available to the contained process and allocate a pseudo-TTY for container

```bash
$MASK container run \
  ${interactive:+'-it'} \
  'pnpm exec neu update --latest && pnpm dev'
```
