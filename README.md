# Lum Bot Docker Deployment Documentation

Complete reference documentation for deploying a Bun/TypeScript Discord bot on Raspberry Pi 5 using Docker, GitHub Actions CI/CD, and automated updates.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Dockerfile](#dockerfile)
3. [.dockerignore](#dockerignore)
4. [GitHub Actions Workflow](#github-actions-workflow)
5. [docker-compose.yml (Pi)](#docker-composeyml)
6. [Environment Variables](#environment-variables)
7. [Error Notification Utility](#error-notification-utility)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The deployment follows a continuous delivery pipeline:

```
Developer pushes to main
        │
        ▼
GitHub Actions triggers
        │
        ├─► Builds ARM64 Docker image using QEMU emulation
        │
        ▼
Pushes image to ghcr.io (GitHub Container Registry)
        │
        ▼
Watchtower on Pi detects new image (polls every 5 min)
        │
        ▼
Watchtower pulls and restarts container automatically
        │
        ▼
On error, bot sends email alert via Resend API
```

This approach means you never SSH into the Pi to deploy.

Just `git push` and wait.

---

## Dockerfile

**Location:** Repository root (`/dockerfile`)

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

# Final image
FROM oven/bun:1-slim
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

ENV NODE_ENV=production

CMD ["bun", "run", "src/bot.ts"]
```

### Detailed Breakdown

#### Stage 1: Base Image

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app
```

- **`FROM oven/bun:1 AS base`**: Uses the official Bun runtime image. The `:1` tag means "latest 1.x version" providing automatic minor/patch updates while avoiding breaking changes. The `AS base` names this stage for reference.
- **`WORKDIR /app`**: Sets `/app` as the working directory for all subsequent commands. Creates the directory if it doesn't exist.

#### Stage 2: Dependencies

```dockerfile
FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production
```

- **`FROM base AS deps`**: Creates a new build stage inheriting from `base`. Multi-stage builds let us discard intermediate layers, reducing final image size.
- **`COPY package.json bun.lockb* ./`**: Copies dependency manifests. The `*` after `bun.lockb` makes the lockfile optional (won't fail if missing), though having one is recommended for reproducible builds.
- **`--frozen-lockfile`**: Ensures exact versions from lockfile are used. Fails if lockfile is out of sync with package.json, preventing "works on my machine" issues.
- **`--production`**: Skips devDependencies (testing frameworks, linters, etc.), reducing image size and attack surface.

#### Stage 3: Final Image

```dockerfile
FROM oven/bun:1-slim
WORKDIR /app
```

- **`oven/bun:1-slim`**: A minimal Bun image without extra tools. Significantly smaller than the full image (~50MB vs ~150MB). Safe for production since we don't need build tools at runtime.

```dockerfile
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./
```

- **`COPY --from=deps`**: Copies only the installed `node_modules` from the `deps` stage. The intermediate build layers are discarded.
- **`COPY src ./src`**: Copies your source code.
- **`COPY package.json ./`**: Needed for Bun to resolve the entry point and any runtime configuration.

```dockerfile
ENV NODE_ENV=production
```

- Sets the environment to production. Many libraries (including discord.js) behave differently in production mode—less verbose logging, optimized performance, etc.

```dockerfile
CMD ["bun", "run", "src/bot.ts"]
```

- **`CMD`**: The default command when the container starts. Uses exec form (JSON array) rather than shell form for proper signal handling—important for graceful shutdown.
- Bun can run TypeScript directly without a build step, so we just point to the `.ts` file.

### Why Multi-Stage Builds?

Without multi-stage builds, your image would contain:
- Package manager caches
- Build artifacts
- Potentially source maps and dev files

Multi-stage builds produce a minimal image containing only what's needed to run. This means:
- Faster pulls (smaller image)
- Reduced attack surface
- Less disk usage on the Pi

---

## .dockerignore

**Location:** Repository root (`/.dockerignore`)

```
node_modules
.git
.gitignore
.env
*.md
.github
docker-compose*.yml
```

### Purpose

The `.dockerignore` file tells Docker which files to exclude when building the image. This serves multiple purposes:

| Entry | Reason |
|-------|--------|
| `node_modules` | Dependencies are installed fresh inside the container. Including local node_modules would override the container's architecture-specific builds (your Mac's binaries won't work on ARM64 Linux). |
| `.git` | Git history is unnecessary in production and adds significant size. |
| `.gitignore` | Not needed at runtime. |
| `.env` | **Critical security concern.** Never bake secrets into images. Environment variables are injected at runtime via docker-compose. |
| `*.md` | Documentation files aren't needed to run the bot. |
| `.github` | CI/CD workflows are only used by GitHub Actions, not the container. |
| `docker-compose*.yml` | Compose files are used to *run* containers, not inside them. |

### Security Note

Even if you add `.env` to `.dockerignore`, be careful: if you accidentally committed secrets to git history, they could still end up in the image via the `.git` folder. The `.git` exclusion helps here, but you should also ensure secrets were never committed.

---

## GitHub Actions Workflow

**Location:** `/.github/workflows/build-push.yml`

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest
            type=sha,prefix=

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Detailed Breakdown

#### Triggers

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

- **`push: branches: [main]`**: Runs automatically whenever code is pushed to the `main` branch. This includes direct pushes and merged pull requests.
- **`workflow_dispatch`**: Adds a "Run workflow" button in the GitHub Actions UI for manual triggers. Useful for rebuilding without code changes (e.g., if a base image was updated).

#### Environment Variables

```yaml
env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}
```

- **`REGISTRY`**: GitHub Container Registry. Alternatives include Docker Hub (`docker.io`) or self-hosted registries.
- **`IMAGE_NAME`**: Automatically set to `burkemtaylor/lum-bot` based on your repository. The `${{ github.repository }}` syntax pulls this from GitHub's context.

#### Permissions

```yaml
permissions:
  contents: read
  packages: write
```

- **`contents: read`**: Allows checking out the repository code.
- **`packages: write`**: Allows pushing images to GitHub Container Registry. This is required because ghcr.io is part of GitHub Packages.

These are minimal permissions following the principle of least privilege.

#### Step: Checkout

```yaml
- name: Checkout repository
  uses: actions/checkout@v4
```

Clones your repository into the runner. Without this, the workflow has no access to your code.

#### Step: QEMU Setup

```yaml
- name: Set up QEMU
  uses: docker/setup-qemu-action@v3
```

**QEMU** is an emulator that allows building ARM64 images on x86_64 GitHub runners. Without this, you'd need an actual ARM machine to build ARM images.

The emulation is slower than native builds but works reliably. A typical Bun project builds in 2-4 minutes.

#### Step: Buildx Setup

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3
```

**Buildx** is Docker's extended build tool supporting:
- Multi-platform builds (we use `linux/arm64`)
- Advanced caching
- Build secrets
- Concurrent builds

Standard `docker build` can't target different architectures.

#### Step: Registry Login

```yaml
- name: Log in to Container Registry
  uses: docker/login-action@v3
  with:
    registry: ${{ env.REGISTRY }}
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

- **`github.actor`**: The username of whoever triggered the workflow.
- **`secrets.GITHUB_TOKEN`**: An automatically-generated token with permissions defined in the `permissions` block. You don't need to create this—GitHub provides it.

For public repositories, no additional setup is needed. Private repositories may require a Personal Access Token (PAT) with `read:packages` and `write:packages` scopes.

#### Step: Metadata Extraction

```yaml
- name: Extract metadata
  id: meta
  uses: docker/metadata-action@v5
  with:
    images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
    tags: |
      type=raw,value=latest
      type=sha,prefix=
```

Generates Docker tags and labels automatically:

- **`type=raw,value=latest`**: Always tags the image as `latest`. Watchtower looks for this tag.
- **`type=sha,prefix=`**: Also tags with the git commit SHA (e.g., `abc1234`). Useful for rollbacks—you can deploy a specific version by SHA.

The `id: meta` allows later steps to reference outputs via `${{ steps.meta.outputs.tags }}`.

#### Step: Build and Push

```yaml
- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: .
    platforms: linux/arm64
    push: true
    tags: ${{ steps.meta.outputs.tags }}
    labels: ${{ steps.meta.outputs.labels }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

- **`context: .`**: Use the repository root as the build context.
- **`platforms: linux/arm64`**: Build specifically for ARM64 (Raspberry Pi 5's architecture). If you also wanted x86_64 support, you'd use `linux/amd64,linux/arm64`.
- **`push: true`**: Push to the registry after building.
- **`cache-from/cache-to: type=gha`**: Use GitHub Actions cache for Docker layers. Dramatically speeds up subsequent builds by reusing unchanged layers.

---

## docker-compose.yml

**Location:** On the Raspberry Pi at `~/lum-bot/docker-compose.yml`

```yaml
services:
  lum-bot:
    image: ghcr.io/burkemtaylor/lum-bot:latest
    container_name: lum-bot
    restart: unless-stopped
    env_file:
      - .env

  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=300
      - WATCHTOWER_INCLUDE_STOPPED=true
```

### The lum-bot Service

```yaml
lum-bot:
  image: ghcr.io/burkemtaylor/lum-bot:latest
  container_name: lum-bot
  restart: unless-stopped
  env_file:
    - .env
```

| Property | Purpose |
|----------|---------|
| `image` | The full image path on GitHub Container Registry. The `:latest` tag means "most recent build." |
| `container_name` | Gives the container a predictable name. Without this, Docker generates random names like `lum-bot-xyz123`. Makes `docker logs lum-bot` work consistently. |
| `restart: unless-stopped` | Automatically restart if the container crashes or the Pi reboots. Only stops if you explicitly run `docker compose down`. |
| `env_file` | Loads environment variables from `.env` in the same directory. Keeps secrets out of the compose file itself. |

### The Watchtower Service

```yaml
watchtower:
  image: containrrr/watchtower
  container_name: watchtower
  restart: unless-stopped
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  environment:
    - WATCHTOWER_CLEANUP=true
    - WATCHTOWER_POLL_INTERVAL=300
    - WATCHTOWER_INCLUDE_STOPPED=true
```

**Watchtower** monitors your running containers and automatically updates them when new images are available.

| Property | Purpose |
|----------|---------|
| `volumes: /var/run/docker.sock` | Gives Watchtower access to Docker's control socket. This is how it can pull images and restart containers. |
| `WATCHTOWER_CLEANUP=true` | Removes old images after updating. Prevents disk space from filling up with outdated versions. |
| `WATCHTOWER_POLL_INTERVAL=300` | Check for updates every 300 seconds (5 minutes). Lower values mean faster deployments but more registry API calls. |
| `WATCHTOWER_INCLUDE_STOPPED=true` | Also update containers that are stopped. Useful if your bot crashed and is in a stopped state. |

### Security Consideration

Mounting `/var/run/docker.sock` gives Watchtower full control over Docker. This is necessary for its function but means a compromised Watchtower container could control all containers. For a home lab / personal project, this is acceptable. In higher-security environments, you'd use alternative update strategies.

---

## Environment Variables

**Location:** On the Raspberry Pi at `~/lum-bot/.env`

```bash
DISCORD_TOKEN=your_token_here
GUILD_ID=your_guild_id
CLIENT_ID=your_client_id
DEV_ID=your_dev_id
RESEND_API_KEY=your_resend_key
ALERT_DESTINATION=burke@burketaylor.com
```

### Variable Reference

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `DISCORD_TOKEN` | Bot authentication token | Discord Developer Portal → Your App → Bot → Token |
| `GUILD_ID` | Your Discord server's ID | Right-click server → Copy Server ID (enable Developer Mode in Discord settings) |
| `CLIENT_ID` | Bot's application ID | Discord Developer Portal → Your App → General Information → Application ID |
| `DEV_ID` | Your personal Discord user ID | Right-click your name → Copy User ID |
| `RESEND_API_KEY` | API key for sending emails | Resend dashboard → API Keys |
| `ALERT_DESTINATION` | Where to send error alerts | Your email address |

### Security Best Practices

1. **Never commit `.env` to git.** Add it to `.gitignore`.
2. **Use restrictive file permissions:**
   ```bash
   chmod 600 ~/lum-bot/.env
   ```
3. **Rotate tokens periodically.** If you suspect a leak, regenerate the Discord token immediately.
4. **Back up your `.env` securely.** If the SD card fails, you'll need these values to redeploy.

---

## Error Notification Utility

**Location:** `/src/utils/notify.ts`

```typescript
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL = process.env.ALERT_EMAIL;

export async function sendErrorAlert(error: Error, context?: string): Promise<void> {
  if (!RESEND_API_KEY || !ALERT_EMAIL) {
    console.error("[notify] Missing RESEND_API_KEY or ALERT_EMAIL, skipping email");
    return;
  }

  const subject = `🚨 Lum Bot Error: ${error.message.slice(0, 50)}`;
  const body = `
    <h2>Bot Error Alert</h2>
    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
    <p><strong>Context:</strong> ${context || "Unknown"}</p>
    <p><strong>Error:</strong> ${error.message}</p>
    <pre>${error.stack}</pre>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Lum Bot <alerts@yourdomain.com>",
        to: [ALERT_EMAIL],
        subject,
        html: body,
      }),
    });

    if (!res.ok) {
      console.error("[notify] Failed to send alert:", await res.text());
    }
  } catch (e) {
    console.error("[notify] Error sending alert:", e);
  }
}
```

### How It Works

1. **Environment Check**: Gracefully skips if credentials are missing, avoiding crashes during local development.
2. **Subject Truncation**: Limits error message to 50 characters in subject line—email clients truncate long subjects anyway.
3. **HTML Body**: Includes timestamp, context, message, and full stack trace for debugging.
4. **Non-throwing**: Wrapped in try/catch so a failed email doesn't cascade into more errors.

### Integration Points

Add these handlers in your `bot.ts`:

```typescript
import { sendErrorAlert } from "./utils/notify";

// Discord.js client errors
client.on("error", (error) => {
  console.error("Discord client error:", error);
  sendErrorAlert(error, "Discord client error");
});

// Uncaught exceptions (synchronous errors that bubble up)
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  sendErrorAlert(error, "Uncaught exception");
  // Note: After uncaughtException, the process is in an undefined state.
  // It's often best to exit and let Docker restart the container.
  process.exit(1);
});

// Unhandled promise rejections (async errors without .catch())
process.on("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  console.error("Unhandled rejection:", error);
  sendErrorAlert(error, "Unhandled rejection");
});
```

### Resend "From" Address

The `from` field requires a verified domain or Resend's test domain:

- **With your domain**: Add DNS records in Resend dashboard, then use `alerts@yourdomain.com`
- **Test mode**: Use `onboarding@resend.dev` (only sends to your verified email)

---

## Troubleshooting

### Image Won't Pull on Pi

**Symptom:** `docker compose up` fails with authentication errors.

**Solution:** Authenticate with GitHub Container Registry:
```bash
docker login ghcr.io -u burkemtaylor
# Enter a Personal Access Token with read:packages scope as the password
```

Generate a PAT at: https://github.com/settings/tokens

### Watchtower Not Updating

**Symptom:** You push code but the bot doesn't update.

**Checks:**
1. Verify the Actions workflow succeeded (GitHub → Actions tab)
2. Check Watchtower logs: `docker logs watchtower`
3. Manually pull to test: `docker pull ghcr.io/burkemtaylor/lum-bot:latest`

### Bot Crashes Immediately

**Symptom:** Container restarts repeatedly.

**Debug:**
```bash
docker logs lum-bot --tail 50
```

Common causes:
- Missing environment variables
- Invalid Discord token
- Syntax errors in code

### Can't Reach Pi Remotely

**Symptom:** SSH times out from outside your local network.

**Solution:** Ensure Tailscale is running:
```bash
sudo tailscale status
```

If disconnected:
```bash
sudo tailscale up
```

### Out of Disk Space

**Symptom:** Docker operations fail with "no space left on device."

**Solution:** Clean up Docker resources:
```bash
docker system prune -a
```

This removes:
- Stopped containers
- Unused networks
- Dangling images
- Build cache

---

## Quick Reference Commands

| Task | Command |
|------|---------|
| Start bot | `cd ~/lum-bot && docker compose up -d` |
| Stop bot | `cd ~/lum-bot && docker compose down` |
| View logs | `docker logs -f lum-bot` |
| Restart bot | `docker restart lum-bot` |
| Force pull latest | `docker compose pull && docker compose up -d` |
| Check container status | `docker ps` |
| Check disk usage | `docker system df` |
| SSH via Tailscale | `ssh pi@pibot` |

---

## File Checklist

Before deploying, ensure you have:

**In your GitHub repository:**
- [ ] `Dockerfile`
- [ ] `.dockerignore`
- [ ] `.github/workflows/build-push.yml`
- [ ] `src/utils/notify.ts`
- [ ] Error handlers added to `bot.ts`

**On the Raspberry Pi:**
- [ ] Docker installed
- [ ] Tailscale installed and authenticated
- [ ] `~/lum-bot/docker-compose.yml`
- [ ] `~/lum-bot/.env` with all variables
- [ ] Logged in to ghcr.io

**External services:**
- [ ] Resend account with API key
- [ ] Domain verified in Resend (or using test domain)