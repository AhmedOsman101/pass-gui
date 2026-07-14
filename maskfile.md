# pass-gui

## lint

> Lint the project

```bash
unset BIOME_CONFIG_PATH
biome lint .
```

## format

> Lint and format the project

```bash
unset BIOME_CONFIG_PATH
biome check --fix .
```

### unsafe

> Lint and format with unsafe fixes

```bash
unset BIOME_CONFIG_PATH
biome check --fix --unsafe .
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
rm -rf client/dist build
```

## release

> Build a release version with embedded resources

```bash
$MASK clean && neu build --release --clean --embed-resources
```

## test

> Run unit tests

```bash
$MASK test unit
```

### unit

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
echo hi
```

#### build

> Builds the container for integration testing

```bash
podman build \
  --build-arg USER_UID="$(id -u)" \
  --build-arg USER_GID="$(id -g)" \
  -t pass-gui-test \
  -f Containerfile.test .
```

#### run

> Builds the container for integration testing

```bash
podman run --rm -it \
  --userns=keep-id \
  -v "$(pwd)":/app \
  pass-gui-test \
  sh -c "pnpm install && pnpm vitest run tests/integration"
```
