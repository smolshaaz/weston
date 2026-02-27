#!/usr/bin/env node
const net = require("node:net");
const path = require("node:path");
const { exec, spawn } = require("node:child_process");

const HOST = "127.0.0.1";
const DEFAULT_PORT = 18797;
const MAX_PORT_TRIES = 50;

function openBrowser(url) {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? `open "${url}"`
      : platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;

  exec(cmd);
}

function isPortFree(port, host) {
  return new Promise((resolve) => {
    const server = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        server.close(() => resolve(true));
      })
      .listen(port, host);
  });
}

async function pickPort(startPort, host) {
  for (let i = 0; i < MAX_PORT_TRIES; i++) {
    const port = startPort + i;
    // eslint-disable-next-line no-await-in-loop
    const free = await isPortFree(port, host);
    if (free) return port;
  }

  throw new Error(
    `No free port found in range ${startPort}-${startPort + MAX_PORT_TRIES - 1}`
  );
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(url, timeoutMs = 30_000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2_000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(t);

      if (res.ok) return;
    } catch {
      // ignore and retry
    }

    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function startNextDev(projectRoot, port) {
  const nextBin = path.join(
    projectRoot,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next"
  );

  const args = [
    nextBin,
    "dev",
    "--port",
    String(port),
    "--hostname",
    HOST,
  ];

  return spawn(process.execPath, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env },
  });
}

async function main() {
  const projectRoot = path.join(__dirname, "..");

  const port = await pickPort(DEFAULT_PORT, HOST);
  const baseUrl = `http://${HOST}:${port}`;
  const healthUrl = `${baseUrl}/api/health`;

  console.log(`\nStarting Weston at ${baseUrl}\n`);

  const server = startNextDev(projectRoot, port);

  server.on("exit", (code) => {
    if (typeof code === "number" && code !== 0) process.exit(code);
  });

  try {
    await waitForHealth(healthUrl, 30_000);
    console.log(`\nWeston ready ✅ Opening browser…\n`);
    openBrowser(baseUrl);
  } catch (err) {
    console.error("\nWeston failed to start ❌");
    console.error(err instanceof Error ? err.message : err);
    server.kill();
    process.exit(1);
  }

  process.on("SIGINT", () => {
    server.kill();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    server.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});